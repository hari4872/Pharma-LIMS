using LIMS.Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.Checkpoints;

public record GetEmReadingsQuery(DateOnly Date) : IRequest<List<EmReadingDto>>;

public record EmReadingDto(
    int ReadingId,
    int RowId,
    string EmSampleNumber,
    int? EmSampleId,
    string CheckpointCode,
    string? SystemName,
    string? Location,
    string SlotLabel,
    DateOnly SamplingDate,
    string ParameterName,
    string? Uom,
    string Value,
    string? ResultStatus,    // Pass | AlertExceeded | ActionExceeded
    decimal? AlertMin, decimal? AlertMax,
    decimal? ActionMin, decimal? ActionMax,
    string RecordedBy,
    DateTimeOffset RecordedAt,
    string? SignedBy,
    DateTimeOffset? SignedAt);

public class GetEmReadingsQueryHandler : IRequestHandler<GetEmReadingsQuery, List<EmReadingDto>>
{
    private readonly ILimsDbContext _db;
    public GetEmReadingsQueryHandler(ILimsDbContext db) => _db = db;

    public async Task<List<EmReadingDto>> Handle(GetEmReadingsQuery req, CancellationToken ct)
    {
        // Join: ProcessLogReadings → ProcessLogRows → EmSamples + Checkpoints + Parameters + Signatures
        var rows = await _db.ProcessLogReadings
            .Include(r => r.Row)
                .ThenInclude(row => row.Checkpoint)
            .Include(r => r.Row)
                .ThenInclude(row => row.Signature)
            .Include(r => r.Parameter)
            .Where(r =>
                r.Row.Checkpoint.Category == "Environmental" &&
                DateOnly.FromDateTime(r.Row.SlotTime.UtcDateTime) == req.Date &&
                r.Row.Status == "Locked")
            .OrderBy(r => r.Row.SlotTime)
            .ThenBy(r => r.Parameter.ParameterName)
            .ToListAsync(ct);

        if (rows.Count == 0) return [];

        // Load linked EmSamples keyed by (CheckpointId, SlotLabel, SamplingDate)
        var emSamples = await _db.EmSamples
            .Where(s => s.SamplingDate == req.Date)
            .ToListAsync(ct);

        var emIndex = emSamples
            .GroupBy(s => (s.CheckpointId, s.SlotLabel))
            .ToDictionary(g => g.Key, g => g.First());

        // Load checkpoint parameters for limit snapshots
        var cpIds = rows.Select(r => r.Row.CheckpointId).Distinct().ToList();
        var cpParams = await _db.CheckpointParameters
            .Where(p => cpIds.Contains(p.CheckpointId))
            .ToListAsync(ct);
        var limitIndex = cpParams.ToDictionary(
            p => (p.CheckpointId, p.ParameterId),
            p => (p.AlertMin, p.AlertMax, p.ActionMin, p.ActionMax));

        return rows.Select(r =>
        {
            emIndex.TryGetValue((r.Row.CheckpointId, r.Row.SlotLabel), out var em);
            limitIndex.TryGetValue((r.Row.CheckpointId, r.ParameterId), out var lim);
            return new EmReadingDto(
                r.ReadingId,
                r.RowId,
                em?.SampleNumber ?? $"EM-{r.Row.Checkpoint.CheckpointCode}-{req.Date:yyyyMMdd}",
                em?.EmSampleId,
                r.Row.Checkpoint.CheckpointCode,
                r.Row.Checkpoint.SystemName,
                r.Row.Checkpoint.Location,
                r.Row.SlotLabel,
                req.Date,
                r.Parameter.ParameterName,
                r.Parameter.Uom,
                r.Value,
                em?.ResultStatus,
                lim.AlertMin, lim.AlertMax,
                lim.ActionMin, lim.ActionMax,
                r.RecordedBy,
                r.RecordedAt,
                r.Row.Signature?.FullName,
                r.Row.Signature?.SignedAt);
        }).ToList();
    }
}
