using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.TestExecutions;

// Lab Manager assigns a sample to an analyst before analyst opens Work Queue (WAP FR-13)
public record AssignWorkQueueItemCommand(
    int SampleId, int AnalystId, int InstrumentId,
    int AssignedById, int? PriorityScore) : IRequest<Result<int>>;

public class AssignWorkQueueItemHandler : IRequestHandler<AssignWorkQueueItemCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IMasterDataAuditService _audit;
    public AssignWorkQueueItemHandler(ILimsDbContext db, IMasterDataAuditService audit) { _db = db; _audit = audit; }

    public async Task<Result<int>> Handle(AssignWorkQueueItemCommand cmd, CancellationToken ct)
    {
        var sample = await _db.Samples.FirstOrDefaultAsync(s => s.SampleId == cmd.SampleId, ct);
        if (sample is null) return Result<int>.Failure("NOT_FOUND", "Sample not found.");
        if (sample.Status != SampleStatus.PendingTesting)
            return Result<int>.Failure("INVALID_STATE", $"Sample status is '{sample.Status}' — must be PendingTesting.");

        var analyst = await _db.Users.FirstOrDefaultAsync(u => u.UserId == cmd.AnalystId && u.IsActive, ct);
        if (analyst is null) return Result<int>.Failure("NOT_FOUND", "Analyst not found or inactive.");

        // WAP FR-14: training check — hard block if expired
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var trained = await _db.UserTrainingRecords.AnyAsync(
            t => t.UserId == cmd.AnalystId && t.ValidUntil >= today, ct);
        if (!trained)
            return Result<int>.Failure("TRAINING_EXPIRED", "Analyst training expired — WAP assignment blocked. (21 CFR 11.10(i))");

        // WAP FR-14: instrument calibration check — hard block if OOC
        var instrument = await _db.Instruments.FirstOrDefaultAsync(i => i.InstrumentId == cmd.InstrumentId && i.IsActive, ct);
        if (instrument is null) return Result<int>.Failure("NOT_FOUND", "Instrument not found or inactive.");
        if (instrument.Status == InstrumentStatus.OutOfCalibration || instrument.Status == InstrumentStatus.Maintenance)
            return Result<int>.Failure("INSTRUMENT_OOC", $"Instrument is {instrument.Status} — WAP assignment blocked. (21 CFR 211.68)");
        if (instrument.CalibrationDue < today)
            return Result<int>.Failure("INSTRUMENT_OOC", "Instrument calibration expired — WAP assignment blocked. (21 CFR 211.68)");

        // Re-use any execution the spec engine already created at registration (Assigned, no analyst yet).
        // Creating a second row would leave the spec-engine execution orphaned and confuse downstream
        // sign-off, peer review, and CoA generation which all key off ExecutionId.
        var execution = await _db.TestExecutions
            .FirstOrDefaultAsync(e => e.SampleId == cmd.SampleId
                && (e.Status == TestExecutionStatus.Assigned || e.Status == TestExecutionStatus.InProgress), ct);

        if (execution is not null)
        {
            // Update the existing execution with the assigned analyst + instrument
            execution.AnalystId    = cmd.AnalystId;
            execution.InstrumentId = cmd.InstrumentId;
            execution.AssignedById = cmd.AssignedById;
            execution.PriorityScore = cmd.PriorityScore ?? execution.PriorityScore;
            execution.Status       = TestExecutionStatus.Assigned;
        }
        else
        {
            // No spec-engine execution exists — create one (manual assignment path)
            execution = new TestExecution
            {
                SampleId       = cmd.SampleId,
                InstrumentId   = cmd.InstrumentId,
                AnalystId      = cmd.AnalystId,
                AssignedById   = cmd.AssignedById,
                FormTemplateId = sample.FormTemplateId,
                PriorityScore  = cmd.PriorityScore,
                Status         = TestExecutionStatus.Assigned,
                CreatedBy      = analyst.FullName,
                CreatedAt      = DateTimeOffset.UtcNow
            };
            _db.TestExecutions.Add(execution);
        }

        sample.Status = SampleStatus.InTesting;
        await _db.SaveChangesAsync(ct);
        await _audit.LogAsync("WorkQueue", cmd.SampleId, "Assigned",
            null,
            new { cmd.AnalystId, cmd.InstrumentId, cmd.PriorityScore },
            "System");
        return Result<int>.Success(execution.ExecutionId);
    }
}
