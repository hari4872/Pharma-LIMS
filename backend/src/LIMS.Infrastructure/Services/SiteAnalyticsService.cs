using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Infrastructure.Services;

/// <summary>
/// MS-4: Aggregates cross-site analytics.
/// All queries avoid N+1 — single DB round-trips per method.
/// </summary>
public class SiteAnalyticsService : ISiteAnalyticsService
{
    private readonly ILimsDbContext _db;
    public SiteAnalyticsService(ILimsDbContext db) => _db = db;

    // ── GetSiteKpisAsync ────────────────────────────────────────────────────
    public async Task<List<SiteKpi>> GetSiteKpisAsync(int? periodDays = 30, CancellationToken ct = default)
    {
        var cutoff = DateTimeOffset.UtcNow.AddDays(-(periodDays ?? 30));

        var labs = await _db.Laboratories
            .Where(l => l.IsActive)
            .OrderBy(l => l.LabName)
            .ToListAsync(ct);

        // One query per metric set — grouped by lab
        var sampleGroups = await _db.Samples
            .GroupBy(s => s.LabId)
            .Select(g => new {
                LabId          = g.Key,
                Total          = g.Count(),
                Registered     = g.Count(s => s.Status == SampleStatus.Registered),
                PendingTesting = g.Count(s => s.Status == SampleStatus.PendingTesting),
                InTesting      = g.Count(s => s.Status == SampleStatus.InTesting),
                PendingQA      = g.Count(s => s.Status == SampleStatus.PendingQAReview),
                Released       = g.Count(s => s.Status == SampleStatus.Released),
                Rejected       = g.Count(s => s.Status == SampleStatus.Rejected),
                Overdue        = g.Count(s => s.DueDate.HasValue && s.DueDate < DateTimeOffset.UtcNow
                                    && s.Status != SampleStatus.Released && s.Status != SampleStatus.Rejected),
            })
            .ToDictionaryAsync(g => g.LabId, ct);

        var oosGroups = await _db.DigitalLogbookEntries
            .Where(e => e.IsOos && e.CreatedAt >= cutoff)
            .GroupBy(e => e.Execution.Sample.LabId)
            .Select(g => new { LabId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(g => g.LabId, ct);

        var capaGroups = await _db.ComplaintsDeviations
            .Where(c => c.Status != "Closed" && c.LabId.HasValue)
            .GroupBy(c => c.LabId!.Value)
            .Select(g => new { LabId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(g => g.LabId, ct);

        var transferGroups = await _db.SampleTransfers
            .Where(t => t.Status == SampleTransferStatus.Pending || t.Status == SampleTransferStatus.Accepted || t.Status == SampleTransferStatus.InTransit)
            .GroupBy(t => t.ToLabId)
            .Select(g => new { LabId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(g => g.LabId, ct);

        // TAT: Released samples in period
        var tatGroups = await _db.Samples
            .Where(s => s.Status == SampleStatus.Released && s.CreatedAt >= cutoff)
            .Select(s => new { s.LabId, s.CreatedAt, s.DueDate })
            .ToListAsync(ct);

        var tatByLab = tatGroups
            .GroupBy(s => s.LabId)
            .ToDictionary(
                g => g.Key,
                g => g.Average(s => s.DueDate.HasValue
                    ? (s.DueDate.Value - s.CreatedAt).TotalDays
                    : 0)
            );

        return labs.Select(lab =>
        {
            var sg = sampleGroups.GetValueOrDefault(lab.LabId);
            var total     = sg?.Total ?? 0;
            var released  = sg?.Released ?? 0;
            var oos       = oosGroups.GetValueOrDefault(lab.LabId)?.Count ?? 0;
            var tested    = total > 0 ? (released + (sg?.Rejected ?? 0)) : 0;

            return new SiteKpi(
                LabId:            lab.LabId,
                LabName:          lab.LabName,
                Site:             lab.Site,
                Location:         lab.Location,
                LabType:          lab.LabType.ToString(),
                TotalSamples:     total,
                Registered:       sg?.Registered ?? 0,
                PendingTesting:   sg?.PendingTesting ?? 0,
                InTesting:        sg?.InTesting ?? 0,
                PendingQAReview:  sg?.PendingQA ?? 0,
                Released:         released,
                Rejected:         sg?.Rejected ?? 0,
                OosCount:         oos,
                OpenCapa:         capaGroups.GetValueOrDefault(lab.LabId)?.Count ?? 0,
                OverdueSamples:   sg?.Overdue ?? 0,
                PendingTransfers: transferGroups.GetValueOrDefault(lab.LabId)?.Count ?? 0,
                OosRatePct:       tested > 0 ? Math.Round(oos * 100.0 / tested, 1) : 0,
                AvgTatDays:       Math.Round(tatByLab.GetValueOrDefault(lab.LabId), 1),
                ReleaseRatePct:   total > 0 ? Math.Round(released * 100.0 / total, 1) : 0
            );
        }).ToList();
    }

    // ── GetTatBreakdownAsync ────────────────────────────────────────────────
    public async Task<List<SiteTatBreakdown>> GetTatBreakdownAsync(int? periodDays = 30, CancellationToken ct = default)
    {
        var cutoff = DateTimeOffset.UtcNow.AddDays(-(periodDays ?? 30));

        var rows = await _db.Samples
            .Where(s => s.Status == SampleStatus.Released && s.CreatedAt >= cutoff && s.DueDate.HasValue)
            .Select(s => new { s.LabId, TatDays = (s.DueDate!.Value - s.CreatedAt).TotalDays, Lab = s.Lab.LabName })
            .ToListAsync(ct);

        var labs = await _db.Laboratories.Where(l => l.IsActive).ToDictionaryAsync(l => l.LabId, l => l.LabName, ct);

        return rows
            .GroupBy(r => r.LabId)
            .Select(g => new SiteTatBreakdown(
                LabId:       g.Key,
                LabName:     labs.GetValueOrDefault(g.Key, "Unknown"),
                MinDays:     Math.Round(g.Min(r => r.TatDays), 1),
                AvgDays:     Math.Round(g.Average(r => r.TatDays), 1),
                MaxDays:     Math.Round(g.Max(r => r.TatDays), 1),
                SampleCount: g.Count()
            ))
            .OrderBy(r => r.LabName)
            .ToList();
    }

    // ── GetOosTrendAsync ────────────────────────────────────────────────────
    public async Task<List<SiteOosTrend>> GetOosTrendAsync(int weeks = 8, CancellationToken ct = default)
    {
        var cutoff = DateTimeOffset.UtcNow.AddDays(-weeks * 7);

        var entries = await _db.DigitalLogbookEntries
            .Where(e => e.IsOos && e.CreatedAt >= cutoff)
            .Select(e => new { e.Execution.Sample.LabId, LabName = e.Execution.Sample.Lab.LabName, e.CreatedAt })
            .ToListAsync(ct);

        var labs = entries.GroupBy(e => e.LabId).Select(g => new { g.Key, Name = g.First().LabName });

        return labs.Select(lab =>
        {
            var points = Enumerable.Range(0, weeks).Select(w =>
            {
                var weekStart = DateTimeOffset.UtcNow.AddDays(-(w + 1) * 7);
                var weekEnd   = DateTimeOffset.UtcNow.AddDays(-w * 7);
                return new OosWeekPoint(
                    WeekLabel: weekStart.ToString("MMM dd"),
                    OosCount:  entries.Count(e => e.LabId == lab.Key && e.CreatedAt >= weekStart && e.CreatedAt < weekEnd)
                );
            }).Reverse().ToList();

            return new SiteOosTrend(lab.Key, lab.Name, points);
        }).ToList();
    }

    // ── GetPendingTransfersAsync ────────────────────────────────────────────
    public async Task<List<TransferSummary>> GetPendingTransfersAsync(int? labId = null, CancellationToken ct = default)
    {
        var q = _db.SampleTransfers
            .Include(t => t.Sample).ThenInclude(s => s.Material)
            .Include(t => t.FromLab)
            .Include(t => t.ToLab)
            .AsQueryable();

        if (labId.HasValue)
            q = q.Where(t => t.FromLabId == labId || t.ToLabId == labId);

        var transfers = await q.OrderByDescending(t => t.RequestedAt).Take(200).ToListAsync(ct);

        return transfers.Select(t => new TransferSummary(
            SampleTransferId: t.SampleTransferId,
            SampleNumber:     t.Sample.SampleNumber,
            MaterialName:     t.Sample.Material.MaterialName,
            LotNumber:        t.Sample.LotNumber,
            FromLabId:        t.FromLabId,
            FromLabName:      t.FromLab.LabName,
            ToLabId:          t.ToLabId,
            ToLabName:        t.ToLab.LabName,
            Status:           t.Status.ToString(),
            TransferReason:   t.TransferReason,
            RequestedBy:      t.RequestedBy,
            RequestedAt:      t.RequestedAt,
            ResponseNote:     t.ResponseNote
        )).ToList();
    }
}
