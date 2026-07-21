using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.DigitalLogbook;

public record GetLogbookEntriesQuery(
    int? SampleId, int? ExecutionId, int? LabId,
    string? Status,
    DateTimeOffset? DateFrom, DateTimeOffset? DateTo) : IRequest<List<LogbookEntryDto>>;

public record LogbookEntryDto(
    int EntryId, int SampleId, string SampleNumber, int ExecutionId,
    int ParameterId, string ParameterName, string Uom, bool IsCritical,
    string TriggerSource,
    string RawValue, decimal? CalculatedResult,
    bool AutoCorrectionApplied, string? CorrectionDetail,
    decimal? SpecMinSnapshot, decimal? SpecMaxSnapshot,
    decimal? OotMinSnapshot, decimal? OotMaxSnapshot,
    string PassFail, bool IsOos, bool IsOot,
    string? InstrumentName, string AnalystName,
    string? EvidenceFileRef, string Status,
    string? SignedByFullName, DateTimeOffset? SignedAt,
    DateTimeOffset CreatedAt);

public class GetLogbookEntriesHandler : IRequestHandler<GetLogbookEntriesQuery, List<LogbookEntryDto>>
{
    private readonly ILimsDbContext _db;
    public GetLogbookEntriesHandler(ILimsDbContext db) => _db = db;

    public async Task<List<LogbookEntryDto>> Handle(GetLogbookEntriesQuery q, CancellationToken ct)
    {
        var query = _db.DigitalLogbookEntries
            .Include(e => e.Sample)
            .Include(e => e.Parameter)
            .Include(e => e.Analyst)
            .Include(e => e.Instrument)
            .Include(e => e.Signature)
            .AsQueryable();

        if (q.SampleId.HasValue) query = query.Where(e => e.SampleId == q.SampleId.Value);
        if (q.ExecutionId.HasValue) query = query.Where(e => e.ExecutionId == q.ExecutionId.Value);
        if (q.LabId.HasValue) query = query.Where(e => e.Sample.LabId == q.LabId.Value);
        if (!string.IsNullOrEmpty(q.Status) && Enum.TryParse<LogbookEntryStatus>(q.Status, out var s))
            query = query.Where(e => e.Status == s);
        if (q.DateFrom.HasValue) query = query.Where(e => e.CreatedAt >= q.DateFrom.Value);
        if (q.DateTo.HasValue) query = query.Where(e => e.CreatedAt <= q.DateTo.Value);

        return await query
            .OrderByDescending(e => e.CreatedAt)
            .Select(e => new LogbookEntryDto(
                e.EntryId, e.SampleId, e.Sample != null ? e.Sample.SampleNumber : "", e.ExecutionId,
                e.ParameterId, e.Parameter != null ? e.Parameter.ParameterName : "Unknown", e.Parameter != null ? (e.Parameter.Uom ?? "") : "", e.Parameter != null && e.Parameter.IsCritical,
                e.TriggerSource.ToString(),
                e.RawValue, e.CalculatedResult,
                e.AutoCorrectionApplied, e.CorrectionDetail,
                e.SpecMinSnapshot, e.SpecMaxSnapshot,
                e.OotMinSnapshot, e.OotMaxSnapshot,
                e.PassFail, e.IsOos, e.IsOot,
                e.Instrument != null ? e.Instrument.InstrumentCode : null,
                e.Analyst != null ? e.Analyst.FullName : "Unknown",
                e.EvidenceFileRef, e.Status.ToString(),
                e.Signature != null ? e.Signature.FullName : null,
                e.Signature != null ? e.Signature.SignedAt : null,
                e.CreatedAt))
            .ToListAsync(ct);
    }
}
