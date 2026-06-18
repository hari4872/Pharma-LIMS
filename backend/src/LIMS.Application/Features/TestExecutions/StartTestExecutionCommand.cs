using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.TestExecutions;

// Analyst scans barcode or selects task — records started_at UTC (ALCOA+ Contemporaneous FR-22)
public record StartTestExecutionCommand(int ExecutionId, int AnalystId, bool IsAdmin = false) : IRequest<Result<int>>;

public class StartTestExecutionHandler : IRequestHandler<StartTestExecutionCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IMasterDataAuditService _audit;
    public StartTestExecutionHandler(ILimsDbContext db, IMasterDataAuditService audit) { _db = db; _audit = audit; }

    public async Task<Result<int>> Handle(StartTestExecutionCommand cmd, CancellationToken ct)
    {
        var execution = await _db.TestExecutions
            .Include(e => e.Instrument)
            .FirstOrDefaultAsync(e => e.ExecutionId == cmd.ExecutionId, ct);
        if (execution is null) return Result<int>.Failure("NOT_FOUND", "Work item not found.");
        if (!cmd.IsAdmin && execution.AnalystId != cmd.AnalystId)
            return Result<int>.Failure("FORBIDDEN", "This task is not assigned to you.");
        if (execution.Status != TestExecutionStatus.Assigned)
            return Result<int>.Failure("INVALID_STATE", $"Task is already {execution.Status}.");

        // Instrument is optional at assignment — analyst selects per-parameter during result entry.
        // Only check calibration if an execution-level instrument was pre-assigned.
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        if (execution.Instrument is not null)
        {
            if (execution.Instrument.Status == InstrumentStatus.OutOfCalibration ||
                execution.Instrument.Status == InstrumentStatus.Maintenance)
                return Result<int>.Failure("INSTRUMENT_OOC", $"Instrument is {execution.Instrument.Status} — test start blocked. (21 CFR 211.68)");
            if (execution.Instrument.CalibrationDue < today)
                return Result<int>.Failure("INSTRUMENT_OOC", "Instrument calibration expired — test start blocked. (21 CFR 211.68)");
        }

        // Analyst training re-check at task open — Admin is exempt (oversight role, not analyst)
        if (!cmd.IsAdmin)
        {
            var trained = await _db.UserTrainingRecords.AnyAsync(
                t => t.UserId == cmd.AnalystId && t.ValidUntil >= today, ct);
            if (!trained)
                return Result<int>.Failure("TRAINING_EXPIRED", "Analyst training expired — test start blocked. (21 CFR 11.10(i))");
        }

        execution.Status = TestExecutionStatus.InProgress;
        execution.StartedAt = DateTimeOffset.UtcNow; // ALCOA+ Contemporaneous — server-side UTC only
        await _db.SaveChangesAsync(ct);
        try
        {
            await _audit.LogAsync("TestExecution", cmd.ExecutionId, "Started",
                new { Status = "Assigned" },
                new { Status = "InProgress", StartedAt = execution.StartedAt },
                "Analyst");
        }
        catch { /* audit failure must not block test start */ }
        return Result<int>.Success(execution.ExecutionId);
    }
}
