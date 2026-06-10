using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.TestExecutions;

// Step 7: Analyst §11.50 e-sig sign-off — logbook rows finalized atomically (FR-06)
public record SignOffTestExecutionCommand(
    int ExecutionId, int UserId,
    string Password, string Meaning, string Reason,
    bool IsAdmin = false) : IRequest<Result<int>>;

public class SignOffTestExecutionHandler : IRequestHandler<SignOffTestExecutionCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IElectronicSignatureService _esig;
    private readonly INotificationService _notify;

    public SignOffTestExecutionHandler(
        ILimsDbContext db,
        IElectronicSignatureService esig,
        INotificationService notify)
    { _db = db; _esig = esig; _notify = notify; }

    public async Task<Result<int>> Handle(SignOffTestExecutionCommand cmd, CancellationToken ct)
    {
        var execution = await _db.TestExecutions
            .Include(e => e.Sample)
            .FirstOrDefaultAsync(e => e.ExecutionId == cmd.ExecutionId, ct);
        if (execution is null) return Result<int>.Failure("NOT_FOUND", "Execution not found.");
        if (!cmd.IsAdmin && execution.AnalystId != cmd.UserId)
            return Result<int>.Failure("FORBIDDEN", "Only the assigned analyst can sign off this task.");
        if (execution.Status != TestExecutionStatus.InProgress)
            return Result<int>.Failure("INVALID_STATE", $"Task status is {execution.Status} — must be InProgress.");

        var pendingEntries = await _db.DigitalLogbookEntries
            .Include(e => e.Parameter)
            .Where(e => e.ExecutionId == cmd.ExecutionId && e.Status == LogbookEntryStatus.Pending)
            .ToListAsync(ct);
        if (pendingEntries.Count == 0)
            return Result<int>.Failure("NO_RESULTS", "No pending results to sign off. Submit results first.");

        // §11.50 e-sig — §11.300 password independent of session token
        var sig = await _esig.CreateSignatureAsync(cmd.UserId, cmd.Password, cmd.Meaning, cmd.Reason, "TestExecution.SignOff", ct);
        if (sig is null) return Result<int>.Failure("ESIGN_AUTH_FAILED", "Password incorrect — e-signature rejected. (21 CFR §11.300)");

        // Atomic: finalize all pending logbook rows and create OOS investigations
        foreach (var entry in pendingEntries)
        {
            entry.Status = LogbookEntryStatus.Signed;
            entry.SignatureId = sig.SignatureId;

            if (entry.IsOos || entry.IsOot)
            {
                var investigation = new OosInvestigation
                {
                    ExecutionId = cmd.ExecutionId,
                    EntryId = entry.EntryId,
                    ParameterId = entry.ParameterId,
                    FlagType = entry.IsOos ? OosFlag.OOS : OosFlag.OOT,
                    Phase = OosPhase.Phase1,
                    Status = OosStatus.Open,
                    OpenedAt = DateTimeOffset.UtcNow,
                    CreatedBy = sig.FullName
                };
                _db.OosInvestigations.Add(investigation);
            }
        }

        bool hasOpenOos = pendingEntries.Any(e => e.IsOos || e.IsOot);
        execution.Status = hasOpenOos ? TestExecutionStatus.OOSOpen : TestExecutionStatus.Completed;
        execution.CompletedAt = DateTimeOffset.UtcNow;

        // LabVantage parity: only advance sample when ALL executions for this sample are done
        // (supports per-test-method assignment where different analysts finish at different times)
        if (!hasOpenOos && execution.Sample is not null)
        {
            var anyStillActive = await _db.TestExecutions
                .AnyAsync(e => e.SampleId == execution.SampleId
                    && e.ExecutionId != execution.ExecutionId
                    && e.Status != TestExecutionStatus.Completed
                    && e.Status != TestExecutionStatus.OOSOpen, ct);

            if (!anyStillActive)
                execution.Sample.Status = SampleStatus.PendingQAReview;
        }

        await _db.SaveChangesAsync(ct);

        // SignalR push — best-effort: never block sign-off if notification fails
        try
        {
            await _notify.PushToGroupAsync("QA", "TestExecutionSigned",
                new { executionId = cmd.ExecutionId, sampleId = execution.SampleId, hasOos = hasOpenOos }, ct);
        }
        catch { /* non-critical */ }

        return Result<int>.Success(execution.ExecutionId);
    }
}
