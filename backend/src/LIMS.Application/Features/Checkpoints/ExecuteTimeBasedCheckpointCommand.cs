using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.Checkpoints;

// Mode 1: analyst manually records and e-signs a time-based checkpoint execution
// Creates a ProcessLogRow (Status=Locked) + readings in one atomic step — ALCOA+ (21 CFR §11.300)
public record ExecuteTimeBasedCheckpointCommand(
    int CheckpointId, int UserId, string SlotLabel,
    string Password, string Meaning, string Reason,
    List<ParameterReadingInput>? Readings = null)
    : IRequest<Result<int>>;

public class ExecuteTimeBasedCheckpointCommandHandler
    : IRequestHandler<ExecuteTimeBasedCheckpointCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IElectronicSignatureService _esig;

    public ExecuteTimeBasedCheckpointCommandHandler(ILimsDbContext db, IElectronicSignatureService esig)
    { _db = db; _esig = esig; }

    public async Task<Result<int>> Handle(ExecuteTimeBasedCheckpointCommand request, CancellationToken ct)
    {
        var checkpoint = await _db.Checkpoints.FindAsync([request.CheckpointId], ct);
        if (checkpoint is null || !checkpoint.IsActive)
            return Result<int>.Failure("NOT_FOUND", "Checkpoint not found or inactive.");

        if (checkpoint.TriggerMode != TriggerType.TimeBased)
            return Result<int>.Failure("INVALID_MODE",
                "The /execute endpoint is for Mode 1 (Time-Based) checkpoints only.");

        // §11.300: verify password independently of session token
        var sig = await _esig.CreateSignatureAsync(request.UserId, request.Password,
            request.Meaning, request.Reason, "ExecuteTimeBasedCheckpoint", ct);
        if (sig is null)
            return Result<int>.Failure("ESIGN_AUTH_FAILED",
                "Electronic signature failed — password incorrect. (21 CFR §11.300)");

        // Create a ProcessLogRow for this execution, immediately locked with e-sig
        var now = DateTimeOffset.UtcNow;
        var row = new ProcessLogRow
        {
            CheckpointId = request.CheckpointId,
            SlotTime     = now,
            SlotLabel    = request.SlotLabel,
            Status       = "Locked",
            SignatureId  = sig.SignatureId,
        };
        _db.ProcessLogRows.Add(row);
        await _db.SaveChangesAsync(ct);

        // Record parameter readings (if provided)
        if (request.Readings is { Count: > 0 })
        {
            var user = await _db.Users.FindAsync([request.UserId], ct);
            var username = user?.Username ?? "analyst";
            foreach (var r in request.Readings.Where(r => !string.IsNullOrWhiteSpace(r.Value)))
            {
                _db.ProcessLogReadings.Add(new ProcessLogReading
                {
                    RowId       = row.RowId,
                    ParameterId = r.ParameterId,
                    Value       = r.Value.Trim(),
                    RecordedAt  = now,
                    RecordedBy  = username,
                });
            }
            await _db.SaveChangesAsync(ct);
        }

        return Result<int>.Success(row.RowId);
    }
}
