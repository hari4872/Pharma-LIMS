using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.OosInvestigations;

// QA/QCLead closes OOS investigation with root cause + CAPA + §11.50 e-sig
public record CloseOosInvestigationCommand(
    int InvestigationId, int UserId,
    string RootCause, string? CapaRef, string? CapaStatus,
    string Password, string Meaning, string Reason) : IRequest<Result<int>>;

public class CloseOosInvestigationHandler : IRequestHandler<CloseOosInvestigationCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IElectronicSignatureService _esig;
    private readonly INotificationService _notify;
    private readonly IMasterDataAuditService _audit;

    public CloseOosInvestigationHandler(ILimsDbContext db, IElectronicSignatureService esig, INotificationService notify, IMasterDataAuditService audit)
    { _db = db; _esig = esig; _notify = notify; _audit = audit; }

    public async Task<Result<int>> Handle(CloseOosInvestigationCommand cmd, CancellationToken ct)
    {
        var inv = await _db.OosInvestigations
            .Include(i => i.Execution).ThenInclude(e => e.Sample)
            .FirstOrDefaultAsync(i => i.InvestigationId == cmd.InvestigationId, ct);
        if (inv is null) return Result<int>.Failure("NOT_FOUND", "Investigation not found.");
        if (inv.Execution?.Sample is null)
            return Result<int>.Failure("DATA_ERROR", "Execution or sample data could not be loaded.");
        if (inv.Status == OosStatus.Closed)
            return Result<int>.Failure("ALREADY_CLOSED", "Investigation is already closed.");

        var sig = await _esig.CreateSignatureAsync(cmd.UserId, cmd.Password, cmd.Meaning, cmd.Reason, "OosInvestigation.Close", ct);
        if (sig is null) return Result<int>.Failure("ESIGN_AUTH_FAILED", "Password incorrect — e-signature rejected. (21 CFR §11.300)");

        inv.Status = OosStatus.Closed;
        inv.RootCause = cmd.RootCause;
        inv.CapaRef = cmd.CapaRef;
        inv.CapaStatus = cmd.CapaStatus;
        inv.SignatureId = sig.SignatureId;
        inv.ClosedAt = DateTimeOffset.UtcNow;

        // Check if all OTHER OOS for this execution are already closed.
        // Must exclude the current investigation (inv) because it is still Open in the DB
        // at this point — SaveChangesAsync hasn't run yet, so the DB query would find it
        // as Open and incorrectly conclude allClosed = false.
        var allClosed = !await _db.OosInvestigations
            .AnyAsync(i => i.ExecutionId == inv.ExecutionId
                        && i.InvestigationId != cmd.InvestigationId
                        && i.Status == OosStatus.Open, ct);
        if (allClosed)
        {
            inv.Execution.Status = TestExecutionStatus.Completed;
            if (inv.Execution.Sample is not null)
                inv.Execution.Sample.Status = SampleStatus.PendingQAReview;
            try
            {
                await _notify.PushToGroupAsync("QA", "OosClosedAllClear",
                    new { executionId = inv.ExecutionId, sampleId = inv.Execution.SampleId }, ct);
            }
            catch { /* non-critical */ }
        }

        await _db.SaveChangesAsync(ct);
        try
        {
            await _audit.LogAsync("OosInvestigation", inv.InvestigationId, "Closed",
                new { inv.Phase, Status = "Open" },
                new { inv.RootCause, inv.CapaRef, inv.CapaStatus, Status = "Closed", SignatureId = sig.SignatureId },
                sig.FullName);
        }
        catch { /* audit failure must not block the close action */ }
        return Result<int>.Success(inv.InvestigationId);
    }
}
