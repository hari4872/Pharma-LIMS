using System.Text.RegularExpressions;
using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.CoA;

public record GetCoAQuery(int? SampleId, string? Status, int? CoaId = null) : IRequest<List<CoADto>>;

public record CoALineDto(
    int CoaLineId, int EntryId, int ParameterId,
    string ParameterName, string MethodCode,
    decimal? SpecMin, decimal? SpecMax, string? RegulatoryTier,
    decimal? CalculatedResult, string PassFail, string AnalystName,
    int DisplayOrder, string Uom = "", string? ParameterGroup = null);

public record CoADto(
    int CoaId, int SampleId, string SampleNumber,
    string MaterialName, string LotNumber,
    string CoaNumber, string Status,
    DateTimeOffset CreatedAt, DateTimeOffset? LockedAt,
    string? CustomerName, string? DoNumber, string? DespatchDate,
    string? QaSignedBy, DateTimeOffset? QaSignedAt,
    int? SupersededById,
    List<CoALineDto> Lines,
    List<CoAApprovalDto> Approvals,
    decimal? LotReleasedQty = null,
    decimal? LotScrappedQty = null,
    // Original inspection values from raw DigitalLogbookEntries (pre-retest snapshot).
    // CoA Lines only store the LATEST signed entry per parameter, so the original OOS
    // values (e.g., 60K inspected, 8K failed) are looked up here separately.
    decimal? OriginalUnitsInspected = null,
    decimal? OriginalUnitsFailed = null);

public record CoAApprovalDto(
    int ApprovalId, string Decision, string? Justification,
    string SignedBy, DateTimeOffset DecidedAt);

public class GetCoAHandler : IRequestHandler<GetCoAQuery, List<CoADto>>
{
    private readonly ILimsDbContext _db;
    public GetCoAHandler(ILimsDbContext db) => _db = db;

    public async Task<List<CoADto>> Handle(GetCoAQuery q, CancellationToken ct)
    {
        var query = _db.Coas
            .Include(c => c.Sample).ThenInclude(s => s.Material)
            .Include(c => c.DeliveryOrder)
            .Include(c => c.QaSignature).ThenInclude(s => s!.User)
            .Include(c => c.Lines)
                .ThenInclude(l => l.Entry).ThenInclude(e => e.Analyst)
            .Include(c => c.Lines)
                .ThenInclude(l => l.Parameter)
            .Include(c => c.Approvals)
                .ThenInclude(a => a.Signature).ThenInclude(s => s.User)
            .AsQueryable();

        if (q.CoaId.HasValue)    query = query.Where(c => c.CoaId == q.CoaId.Value);
        if (q.SampleId.HasValue) query = query.Where(c => c.SampleId == q.SampleId.Value);
        if (!string.IsNullOrWhiteSpace(q.Status) && Enum.TryParse<CoaStatus>(q.Status, true, out var statusEnum))
            query = query.Where(c => c.Status == statusEnum);

        var coas = await query.OrderByDescending(c => c.CreatedAt).ToListAsync(ct);

        // ── Original inspection snapshot from raw DigitalLogbookEntries ─────────
        // CoA Lines keep only the LATEST signed entry per parameter (CoAGenerationService).
        // For parameters with an OOS→Retest flow, the original values (e.g. 60K inspected,
        // 8K failed) are overwritten by the retest values (8K inspected, 0 passed).
        // Reconstruct them here so the LOT DISPOSITION section shows the correct picture.
        var sampleIds = coas.Select(c => c.SampleId).Distinct().ToList();

        var rxInsp = new Regex(@"units?.?inspected", RegexOptions.IgnoreCase);
        var rxFail = new Regex(@"(total.?)?units?.?fail", RegexOptions.IgnoreCase);

        var rawEntries = await _db.DigitalLogbookEntries
            .Where(e => sampleIds.Contains(e.SampleId) && e.Status == LogbookEntryStatus.Signed)
            .Include(e => e.Parameter)
            .Select(e => new {
                e.SampleId, e.EntryId, e.CalculatedResult, e.PassFail,
                ParameterName = e.Parameter != null ? e.Parameter.ParameterName : ""
            })
            .ToListAsync(ct);

        // Original "Units Inspected" = FIRST (lowest EntryId) signed entry for that parameter.
        // The first entry is always the original batch inspection (before any retest cycle).
        var origInspectedMap = rawEntries
            .Where(e => rxInsp.IsMatch(e.ParameterName))
            .GroupBy(e => e.SampleId)
            .ToDictionary(g => g.Key,
                g => g.OrderBy(e => e.EntryId).First().CalculatedResult);

        // Original "Total Units Failed" = the OOS entry (there can only be one OOS per parameter
        // in a valid OOS→Retest chain; retest entries are PASS or fail again).
        var origFailedMap = rawEntries
            .Where(e => rxFail.IsMatch(e.ParameterName)
                     && e.PassFail.Contains("OOS", StringComparison.OrdinalIgnoreCase))
            .GroupBy(e => e.SampleId)
            .ToDictionary(g => g.Key,
                g => g.OrderByDescending(e => e.CalculatedResult ?? 0).First().CalculatedResult);

        return coas.Where(c => c.Sample != null).Select(c => new CoADto(
            c.CoaId, c.SampleId, c.Sample.SampleNumber,
            c.Sample.Material != null ? c.Sample.Material.MaterialName : "Unknown", c.Sample.LotNumber,
            c.CoaNumber, c.Status.ToString(),
            c.CreatedAt, c.LockedAt,
            c.DeliveryOrder?.CustomerName,
            c.DeliveryOrder?.DoNumber,
            c.DeliveryOrder?.DespatchDate?.ToString("yyyy-MM-dd"),
            c.QaSignature?.FullName, c.QaSignature?.SignedAt,
            c.SupersededById,
            c.Lines.OrderBy(l => l.DisplayOrder)
                .Where(l => l.Entry != null)   // skip orphaned lines (duplicate COA cleanup)
                .Select(l => new CoALineDto(
                l.CoaLineId, l.EntryId, l.ParameterId,
                l.Parameter != null ? l.Parameter.ParameterName : "Unknown",
                "",   // MethodCode resolved separately if needed
                l.Entry.SpecMinSnapshot, l.Entry.SpecMaxSnapshot,
                l.Entry.RegulatoryTierSnapshot,
                l.Entry.CalculatedResult, l.Entry.PassFail,
                l.Entry.Analyst != null ? l.Entry.Analyst.FullName : "Unknown",
                l.DisplayOrder,
                l.Parameter != null ? l.Parameter.Uom : "",
                l.Parameter?.ParameterGroup)).ToList(),
            c.Approvals.OrderByDescending(a => a.DecidedAt).Select(a => new CoAApprovalDto(
                a.ApprovalId, a.Decision, a.Justification,
                a.Signature.FullName, a.DecidedAt)).ToList(),
            LotReleasedQty: c.Sample.LotReleasedQty,
            LotScrappedQty: c.Sample.LotScrappedQty,
            OriginalUnitsInspected: origInspectedMap.GetValueOrDefault(c.SampleId),
            OriginalUnitsFailed: origFailedMap.GetValueOrDefault(c.SampleId)
        )).ToList();
    }
}
