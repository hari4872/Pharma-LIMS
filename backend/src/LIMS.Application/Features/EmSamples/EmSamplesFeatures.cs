using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.EmSamples;

// ── DTOs ──────────────────────────────────────────────────────────────────────

public record EmSampleDto(
    int EmSampleId,
    string SampleNumber,
    int CheckpointId,
    string CheckpointCode,
    string? SystemName,
    string? Location,
    string SlotLabel,
    DateOnly SamplingDate,
    string Status,
    DateTimeOffset? CollectedAt, string? CollectedBy,
    DateTimeOffset? ReceivedAt,  string? ReceivedBy,
    DateTimeOffset? AnalysisStartedAt, string? AssignedAnalyst,
    int? ProcessLogRowId,
    DateTimeOffset? ResultsApprovedAt, string? ResultsApprovedBy,
    string? ResultStatus,
    string? InvestigationNumber, string? InvestigationStatus, string? InvestigationNotes,
    DateTimeOffset ExpiresAt,
    DateTimeOffset CreatedAt, string CreatedBy);

// ── GET /em-samples ───────────────────────────────────────────────────────────

public record GetEmSamplesQuery(
    int? CheckpointId = null,
    string? Status = null,
    DateOnly? From = null,
    DateOnly? To = null,
    string? ResultStatus = null) : IRequest<List<EmSampleDto>>;

public class GetEmSamplesQueryHandler : IRequestHandler<GetEmSamplesQuery, List<EmSampleDto>>
{
    private readonly ILimsDbContext _db;
    public GetEmSamplesQueryHandler(ILimsDbContext db) => _db = db;

    public async Task<List<EmSampleDto>> Handle(GetEmSamplesQuery req, CancellationToken ct)
    {
        var q = _db.EmSamples.Include(s => s.Checkpoint).AsQueryable();
        if (req.CheckpointId.HasValue) q = q.Where(s => s.CheckpointId == req.CheckpointId.Value);
        if (!string.IsNullOrEmpty(req.Status) && Enum.TryParse<EmSampleStatus>(req.Status, true, out var st))
            q = q.Where(s => s.Status == st);
        if (req.From.HasValue) q = q.Where(s => s.SamplingDate >= req.From.Value);
        if (req.To.HasValue)   q = q.Where(s => s.SamplingDate <= req.To.Value);
        if (!string.IsNullOrEmpty(req.ResultStatus))
            q = q.Where(s => s.ResultStatus == req.ResultStatus);

        var list = await q.OrderByDescending(s => s.SamplingDate).ThenBy(s => s.SlotLabel).ToListAsync(ct);
        return list.Select(ToDto).ToList();
    }

    internal static EmSampleDto ToDto(EmSample s) => new(
        s.EmSampleId, s.SampleNumber, s.CheckpointId,
        s.Checkpoint.CheckpointCode, s.Checkpoint.SystemName, s.Checkpoint.Location,
        s.SlotLabel, s.SamplingDate, s.Status.ToString(),
        s.CollectedAt, s.CollectedBy, s.ReceivedAt, s.ReceivedBy,
        s.AnalysisStartedAt, s.AssignedAnalyst, s.ProcessLogRowId,
        s.ResultsApprovedAt, s.ResultsApprovedBy, s.ResultStatus,
        s.InvestigationNumber, s.InvestigationStatus, s.InvestigationNotes,
        s.ExpiresAt, s.CreatedAt, s.CreatedBy);
}

// ── POST /em-samples/generate ────────────────────────────────────────────────

public record GenerateEmSamplesCommand(DateOnly Date, string CreatedBy) : IRequest<Result<int>>;

public class GenerateEmSamplesCommandHandler : IRequestHandler<GenerateEmSamplesCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    public GenerateEmSamplesCommandHandler(ILimsDbContext db) => _db = db;

    public async Task<Result<int>> Handle(GenerateEmSamplesCommand req, CancellationToken ct)
    {
        var emCheckpoints = await _db.Checkpoints
            .Where(c => c.Category == "Environmental" && c.LifecycleStatus == "Active")
            .ToListAsync(ct);

        if (emCheckpoints.Count == 0)
            return Result<int>.Failure("NO_ACTIVE_EM", "No active EM checkpoints found.");

        int created = 0;
        var expiresAt = req.Date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc).AddDays(3);

        foreach (var cp in emCheckpoints)
        {
            var slots = ParseSlots(cp.TimeSlots);
            if (slots.Count == 0) slots = ["08:00"];

            // Existing samples for this checkpoint on this date
            var existing = await _db.EmSamples
                .Where(s => s.CheckpointId == cp.CheckpointId && s.SamplingDate == req.Date)
                .Select(s => s.SlotLabel)
                .ToListAsync(ct);

            int seq = existing.Count;
            foreach (var slot in slots)
            {
                if (existing.Contains(slot)) continue;
                seq++;
                var prefix = cp.SystemCode ?? "EM";
                var point  = cp.SamplingPointCode ?? cp.CheckpointCode[..Math.Min(10, cp.CheckpointCode.Length)];
                var sampleNumber = $"{prefix}-{point}-{req.Date:yyyyMMdd}-{seq:D3}";

                // Ensure uniqueness
                var exists = await _db.EmSamples.AnyAsync(s => s.SampleNumber == sampleNumber, ct);
                if (exists) sampleNumber += $"-{DateTimeOffset.UtcNow.Ticks % 1000:D3}";

                _db.EmSamples.Add(new EmSample
                {
                    SampleNumber  = sampleNumber,
                    CheckpointId  = cp.CheckpointId,
                    SlotLabel     = slot,
                    SamplingDate  = req.Date,
                    Status        = EmSampleStatus.Scheduled,
                    ExpiresAt     = new DateTimeOffset(expiresAt),
                    CreatedBy     = req.CreatedBy,
                });
                created++;
            }
        }

        await _db.SaveChangesAsync(ct);
        return Result<int>.Success(created);
    }

    private static List<string> ParseSlots(string? json)
    {
        if (string.IsNullOrEmpty(json)) return [];
        try { return System.Text.Json.JsonSerializer.Deserialize<List<string>>(json) ?? []; }
        catch { return []; }
    }
}

// ── PATCH /em-samples/{id}/collect ───────────────────────────────────────────

public record CollectEmSampleCommand(int EmSampleId, string CollectedBy) : IRequest<Result<int>>;

public class CollectEmSampleCommandHandler : IRequestHandler<CollectEmSampleCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    public CollectEmSampleCommandHandler(ILimsDbContext db) => _db = db;

    public async Task<Result<int>> Handle(CollectEmSampleCommand req, CancellationToken ct)
    {
        var s = await _db.EmSamples.FindAsync([req.EmSampleId], ct);
        if (s is null) return Result<int>.Failure("NOT_FOUND", "Sample not found.");
        if (s.Status != EmSampleStatus.Scheduled)
            return Result<int>.Failure("INVALID_STATE", $"Sample is already {s.Status}.");
        s.Status = EmSampleStatus.Collected;
        s.CollectedAt = DateTimeOffset.UtcNow;
        s.CollectedBy = req.CollectedBy;
        await _db.SaveChangesAsync(ct);
        return Result<int>.Success(s.EmSampleId);
    }
}

// ── PATCH /em-samples/{id}/receive ───────────────────────────────────────────

public record ReceiveEmSampleCommand(int EmSampleId, string ReceivedBy, string? AssignedAnalyst) : IRequest<Result<int>>;

public class ReceiveEmSampleCommandHandler : IRequestHandler<ReceiveEmSampleCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    public ReceiveEmSampleCommandHandler(ILimsDbContext db) => _db = db;

    public async Task<Result<int>> Handle(ReceiveEmSampleCommand req, CancellationToken ct)
    {
        var s = await _db.EmSamples.FindAsync([req.EmSampleId], ct);
        if (s is null) return Result<int>.Failure("NOT_FOUND", "Sample not found.");
        if (s.Status != EmSampleStatus.Collected)
            return Result<int>.Failure("INVALID_STATE", $"Sample must be Collected first (current: {s.Status}).");
        s.Status = EmSampleStatus.ReceivedByLab;
        s.ReceivedAt = DateTimeOffset.UtcNow;
        s.ReceivedBy = req.ReceivedBy;
        s.AssignedAnalyst = req.AssignedAnalyst;
        s.AnalysisStartedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Result<int>.Success(s.EmSampleId);
    }
}

// ── PATCH /em-samples/{id}/results ───────────────────────────────────────────

public record EnterEmResultsCommand(
    int EmSampleId,
    string ResultStatus,          // Pass | AlertExceeded | ActionExceeded
    string ApprovedBy,
    int? ProcessLogRowId = null) : IRequest<Result<int>>;

public class EnterEmResultsCommandHandler : IRequestHandler<EnterEmResultsCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    public EnterEmResultsCommandHandler(ILimsDbContext db) => _db = db;

    public async Task<Result<int>> Handle(EnterEmResultsCommand req, CancellationToken ct)
    {
        var s = await _db.EmSamples.FindAsync([req.EmSampleId], ct);
        if (s is null) return Result<int>.Failure("NOT_FOUND", "Sample not found.");
        if (s.Status == EmSampleStatus.Scheduled)
            return Result<int>.Failure("INVALID_STATE", "Sample must be Collected and Received before entering results.");

        var validResultStatuses = new[] { "Pass", "AlertExceeded", "ActionExceeded" };
        if (!validResultStatuses.Contains(req.ResultStatus))
            return Result<int>.Failure("INVALID_RESULT", "ResultStatus must be Pass, AlertExceeded, or ActionExceeded.");

        s.Status = EmSampleStatus.ResultsApproved;
        s.ResultStatus = req.ResultStatus;
        s.ResultsApprovedAt = DateTimeOffset.UtcNow;
        s.ResultsApprovedBy = req.ApprovedBy;
        if (req.ProcessLogRowId.HasValue) s.ProcessLogRowId = req.ProcessLogRowId;

        // Auto-open investigation on Action limit breach
        if (req.ResultStatus == "ActionExceeded" && string.IsNullOrEmpty(s.InvestigationNumber))
        {
            s.InvestigationNumber = $"INV-EM-{s.SampleNumber}";
            s.InvestigationStatus = "Open";
        }

        await _db.SaveChangesAsync(ct);
        return Result<int>.Success(s.EmSampleId);
    }
}

// ── PATCH /em-samples/{id}/investigation ─────────────────────────────────────

public record UpdateEmInvestigationCommand(
    int EmSampleId,
    string InvestigationStatus,   // Open | Closed
    string? InvestigationNotes) : IRequest<Result<int>>;

public class UpdateEmInvestigationCommandHandler : IRequestHandler<UpdateEmInvestigationCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    public UpdateEmInvestigationCommandHandler(ILimsDbContext db) => _db = db;

    public async Task<Result<int>> Handle(UpdateEmInvestigationCommand req, CancellationToken ct)
    {
        var s = await _db.EmSamples.FindAsync([req.EmSampleId], ct);
        if (s is null) return Result<int>.Failure("NOT_FOUND", "Sample not found.");
        if (string.IsNullOrEmpty(s.InvestigationNumber))
            return Result<int>.Failure("NO_INVESTIGATION", "No investigation linked to this sample.");
        s.InvestigationStatus = req.InvestigationStatus;
        if (req.InvestigationNotes is not null) s.InvestigationNotes = req.InvestigationNotes;
        await _db.SaveChangesAsync(ct);
        return Result<int>.Success(s.EmSampleId);
    }
}
