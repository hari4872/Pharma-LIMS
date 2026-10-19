using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace LIMS.Application.Features.Checkpoints;

// Mode 1: analyst manually records and e-signs a time-based checkpoint execution
// Creates a ProcessLogRow (Status=Locked) + readings in one atomic step — ALCOA+ (21 CFR §11.300)
public record ExecuteTimeBasedCheckpointCommand(
    int CheckpointId, int UserId, string SlotLabel,
    string Password, string Meaning, string Reason,
    List<ParameterReadingInput>? Readings = null,
    int? SampleId = null)
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
        var user = await _db.Users.FindAsync([request.UserId], ct);
        var username = user?.Username ?? "analyst";

        var row = new ProcessLogRow
        {
            CheckpointId = request.CheckpointId,
            SlotTime     = now,
            SlotLabel    = request.SlotLabel,
            Status       = "Locked",
            SignatureId  = sig.SignatureId,
            SampleId     = request.SampleId,
        };
        _db.ProcessLogRows.Add(row);

        if (request.Readings is { Count: > 0 })
        {
            foreach (var r in request.Readings.Where(r => !string.IsNullOrWhiteSpace(r.Value)))
            {
                _db.ProcessLogReadings.Add(new ProcessLogReading
                {
                    Row         = row,
                    ParameterId = r.ParameterId,
                    Value       = r.Value.Trim(),
                    RecordedAt  = now,
                    RecordedBy  = username,
                });
            }
        }

        await _db.SaveChangesAsync(ct);

        // ── EM: auto-update EmSample lifecycle after execution ─────────────────
        // Reload checkpoint with parameters to evaluate limits
        var cp = await _db.Checkpoints
            .Include(c => c.CheckpointParameters)
            .FirstOrDefaultAsync(c => c.CheckpointId == request.CheckpointId, ct);

        if (cp?.Category == "Environmental" && request.Readings is { Count: > 0 })
        {
            var limitIndex = cp.CheckpointParameters.ToDictionary(
                p => p.ParameterId,
                p => (p.AlertMin, p.AlertMax, p.ActionMin, p.ActionMax));

            // Compute worst breach across all readings
            string resultStatus = "Pass";
            foreach (var r in request.Readings.Where(r => !string.IsNullOrWhiteSpace(r.Value)))
            {
                if (!limitIndex.TryGetValue(r.ParameterId, out var lim)) continue;
                if (!decimal.TryParse(r.Value, out var val)) continue;
                if ((lim.ActionMin.HasValue && val < lim.ActionMin) || (lim.ActionMax.HasValue && val > lim.ActionMax))
                { resultStatus = "ActionExceeded"; break; }
                if ((lim.AlertMin.HasValue && val < lim.AlertMin) || (lim.AlertMax.HasValue && val > lim.AlertMax))
                    resultStatus = "AlertExceeded";
            }

            // Find or create EmSample for this checkpoint + date + slot
            var samplingDate = DateOnly.FromDateTime(now.UtcDateTime);
            var emSample = await _db.EmSamples
                .FirstOrDefaultAsync(s => s.CheckpointId == request.CheckpointId
                    && s.SamplingDate == samplingDate && s.SlotLabel == request.SlotLabel, ct);

            if (emSample is null)
            {
                // Auto-create if not pre-generated
                var seq = await _db.EmSamples
                    .CountAsync(s => s.CheckpointId == request.CheckpointId && s.SamplingDate == samplingDate, ct) + 1;
                var prefix = cp.SystemCode ?? "EM";
                var point  = cp.SamplingPointCode ?? cp.CheckpointCode[..Math.Min(10, cp.CheckpointCode.Length)];
                var sampleNumber = $"{prefix}-{point}-{samplingDate:yyyyMMdd}-{seq:D3}";

                emSample = new EmSample
                {
                    SampleNumber  = sampleNumber,
                    CheckpointId  = request.CheckpointId,
                    SlotLabel     = request.SlotLabel,
                    SamplingDate  = samplingDate,
                    ExpiresAt     = new DateTimeOffset(samplingDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc).AddDays(3)),
                    CreatedBy     = username,
                };
                _db.EmSamples.Add(emSample);
            }

            // Advance lifecycle: mark collected → received → results in one step (execution = lab action)
            emSample.Status            = EmSampleStatus.ResultsApproved;
            emSample.CollectedAt     ??= now;
            emSample.CollectedBy     ??= username;
            emSample.ReceivedAt      ??= now;
            emSample.ReceivedBy      ??= username;
            emSample.AnalysisStartedAt ??= now;
            emSample.AssignedAnalyst ??= username;
            emSample.ProcessLogRowId   = row.RowId;
            emSample.ResultStatus      = resultStatus;
            emSample.ResultsApprovedAt = now;
            emSample.ResultsApprovedBy = username;

            // Auto-open investigation on Action breach
            if (resultStatus == "ActionExceeded" && string.IsNullOrEmpty(emSample.InvestigationNumber))
            {
                emSample.InvestigationNumber = $"INV-EM-{emSample.SampleNumber}";
                emSample.InvestigationStatus = "Open";
            }

            await _db.SaveChangesAsync(ct);
        }

        return Result<int>.Success(row.RowId);
    }
}
