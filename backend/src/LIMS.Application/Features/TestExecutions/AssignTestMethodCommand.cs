using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.TestExecutions;

/// <summary>
/// Per-test-method assignment — assigns a specific analyst to a specific TestExecution.
/// Complements AssignWorkQueueItemCommand (sample-level) — both modes supported.
/// LabVantage parity: different analysts can be assigned to different test methods on the same sample.
/// </summary>
public record AssignTestMethodCommand(
    int ExecutionId,
    int AnalystId,
    int? InstrumentId,
    int AssignedById,
    int? PriorityScore = null) : IRequest<Result<int>>;

public class AssignTestMethodHandler : IRequestHandler<AssignTestMethodCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly INotificationService _notify;

    public AssignTestMethodHandler(ILimsDbContext db, INotificationService notify)
    { _db = db; _notify = notify; }

    public async Task<Result<int>> Handle(AssignTestMethodCommand cmd, CancellationToken ct)
    {
        var execution = await _db.TestExecutions
            .Include(e => e.Sample)
            .FirstOrDefaultAsync(e => e.ExecutionId == cmd.ExecutionId, ct);

        if (execution is null)
            return Result<int>.Failure("NOT_FOUND", "Test execution not found.");
        if (execution.Sample is null)
            return Result<int>.Failure("DATA_ERROR", "Sample data could not be loaded.");
        if (execution.Status != TestExecutionStatus.Assigned)
            return Result<int>.Failure("INVALID_STATE",
                $"Execution is '{execution.Status}' — can only reassign Assigned executions.");

        // Validate analyst
        var analyst = await _db.Users.FirstOrDefaultAsync(u => u.UserId == cmd.AnalystId && u.IsActive, ct);
        if (analyst is null)
            return Result<int>.Failure("NOT_FOUND", "Analyst not found or inactive.");

        // Training check (21 CFR §11.10(i))
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var trained = await _db.UserTrainingRecords
            .AnyAsync(t => t.UserId == cmd.AnalystId && t.ValidUntil >= today, ct);
        if (!trained)
            return Result<int>.Failure("TRAINING_EXPIRED",
                "Analyst training expired — assignment blocked. (21 CFR 11.10(i))");

        // Instrument is optional — analyst selects per-parameter at execution time
        if (cmd.InstrumentId.HasValue)
        {
            var instrument = await _db.Instruments
                .FirstOrDefaultAsync(i => i.InstrumentId == cmd.InstrumentId && i.IsActive, ct);
            if (instrument is null)
                return Result<int>.Failure("NOT_FOUND", "Instrument not found or inactive.");
            if (instrument.Status == InstrumentStatus.OutOfCalibration || instrument.Status == InstrumentStatus.Maintenance)
                return Result<int>.Failure("INSTRUMENT_OOC",
                    $"Instrument is {instrument.Status} — assignment blocked. (21 CFR 211.68)");
            if (instrument.CalibrationDue < today)
                return Result<int>.Failure("INSTRUMENT_OOC",
                    "Instrument calibration expired — assignment blocked. (21 CFR 211.68)");
            execution.InstrumentId = cmd.InstrumentId;
        }

        execution.AnalystId    = cmd.AnalystId;
        execution.AssignedById = cmd.AssignedById;
        if (cmd.PriorityScore.HasValue) execution.PriorityScore = cmd.PriorityScore;

        // Only PendingTesting → InTesting; Registered is intentionally excluded (SRF must be signed first via SignSRFCommand)
        if (execution.Sample.Status == SampleStatus.PendingTesting)
            execution.Sample.Status = SampleStatus.InTesting;

        await _db.SaveChangesAsync(ct);

        // Check if ALL executions for this sample now have an analyst assigned
        var allAssigned = !await _db.TestExecutions
            .AnyAsync(e => e.SampleId == execution.SampleId
                && e.Status == TestExecutionStatus.Assigned
                && e.AnalystId == 0, ct);   // AnalystId=0 = unassigned default

        // Notification is best-effort — assignment is already committed
        if (allAssigned)
        {
            try
            {
                await _notify.PushToGroupAsync("QA", "WorkplanFullyAssigned",
                    new { sampleId = execution.SampleId, executionId = cmd.ExecutionId }, ct);
            }
            catch { /* non-critical */ }
        }

        return Result<int>.Success(execution.ExecutionId);
    }
}
