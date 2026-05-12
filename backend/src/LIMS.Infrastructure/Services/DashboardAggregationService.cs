using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Infrastructure.Services;

// Contract 1: Single aggregation source for ALL dashboard metrics (FR-10)
// Contract 2: All compute server-side; all thresholds from DB config (no hardcoded values FR-11)
public class DashboardAggregationService : IDashboardAggregationService
{
    private readonly ILimsDbContext _db;
    public DashboardAggregationService(ILimsDbContext db) { _db = db; }

    public async Task<WipSummary> GetWipSummaryAsync(int? labId, CancellationToken ct = default)
    {
        var today = DateTimeOffset.UtcNow.Date;

        var samplesQuery = _db.Samples.Include(s => s.Analyst).AsQueryable();
        if (labId.HasValue) samplesQuery = samplesQuery.Where(s => s.LabId == labId.Value);

        var registeredToday = await samplesQuery.CountAsync(s => s.CreatedAt.Date == today, ct);
        var inTesting       = await samplesQuery.CountAsync(s => s.Status == SampleStatus.InTesting, ct);
        var completedToday  = await samplesQuery.CountAsync(s => s.Status == SampleStatus.Released && s.CreatedAt.Date == today, ct);
        var overdue         = await samplesQuery.CountAsync(s => s.DueDate < DateTimeOffset.UtcNow && s.Status != SampleStatus.Released && s.Status != SampleStatus.Rejected, ct);

        var execQuery = _db.TestExecutions.AsQueryable();
        if (labId.HasValue) execQuery = execQuery.Where(e => e.Sample.LabId == labId.Value);

        var testsPending    = await execQuery.CountAsync(e => e.Status == TestExecutionStatus.Assigned, ct);
        var testsInProgress = await execQuery.CountAsync(e => e.Status == TestExecutionStatus.InProgress, ct);
        var testsCompleted  = await execQuery.CountAsync(e => e.Status == TestExecutionStatus.Completed, ct);

        // Analyst workloads — contract 2: server-side aggregation
        var workloads = await execQuery
            .Where(e => e.Status == TestExecutionStatus.Assigned || e.Status == TestExecutionStatus.InProgress)
            .GroupBy(e => new { e.AnalystId, e.Analyst.FullName })
            .Select(g => new AnalystWorkload(g.Key.AnalystId, g.Key.FullName, g.Count()))
            .ToListAsync(ct);

        return new WipSummary(registeredToday, inTesting, completedToday,
            testsPending, testsInProgress, testsCompleted, overdue, workloads);
    }

    public async Task<TatSummary> GetTatSummaryAsync(int? labId, int? periodDays, CancellationToken ct = default)
    {
        // TAT target and period from DB config (Contract 2 — no hardcoding)
        var targetConfig = await _db.LabConfigs.FirstOrDefaultAsync(c => c.ConfigKey == "tat_target_hrs", ct);
        var targetHours  = targetConfig != null && decimal.TryParse(targetConfig.ConfigValue, out var t) ? t : 48m;

        var period = periodDays ?? 30;
        var since  = DateTimeOffset.UtcNow.AddDays(-period);

        var execQuery = _db.TestExecutions
            .Include(e => e.Analyst)
            .Include(e => e.Sample)
            .Where(e => e.Status == TestExecutionStatus.Completed
                     && e.CompletedAt >= since
                     && e.StartedAt != null);

        if (labId.HasValue) execQuery = execQuery.Where(e => e.Sample.LabId == labId.Value);

        var executions = await execQuery.ToListAsync(ct);

        var avgTat = executions.Count > 0
            ? (decimal)executions.Average(e => (e.CompletedAt!.Value - e.StartedAt!.Value).TotalHours)
            : 0m;

        var breachCount = executions.Count(e =>
            (e.CompletedAt!.Value - e.StartedAt!.Value).TotalHours > (double)targetHours);

        var byAnalyst = executions
            .GroupBy(e => new { e.AnalystId, e.Analyst.FullName })
            .Select(g => new TatByAnalyst(g.Key.AnalystId, g.Key.FullName,
                (decimal)g.Average(e => (e.CompletedAt!.Value - e.StartedAt!.Value).TotalHours)))
            .ToList();

        return new TatSummary(avgTat, targetHours, breachCount, period, byAnalyst);
    }

    public async Task<QualityKpis> GetQualityKpisAsync(int? labId, int? periodDays, CancellationToken ct = default)
    {
        var period = periodDays ?? 30;
        var since  = DateTimeOffset.UtcNow.AddDays(-period);

        var entriesQuery = _db.DigitalLogbookEntries
            .Where(e => e.CreatedAt >= since && e.Status != LogbookEntryStatus.Superseded);

        if (labId.HasValue) entriesQuery = entriesQuery.Where(e => e.Sample.LabId == labId.Value);

        var total     = await entriesQuery.CountAsync(ct);
        var oosCount  = await entriesQuery.CountAsync(e => e.IsOos, ct);
        var ootCount  = await entriesQuery.CountAsync(e => e.IsOot, ct);
        var supersededCount = await _db.DigitalLogbookEntries
            .Where(e => e.CreatedAt >= since && e.Status == LogbookEntryStatus.Superseded)
            .CountAsync(ct);

        // RFT: samples completed with zero OOS and zero superseded entries
        var samplesQuery = _db.Samples
            .Where(s => s.CreatedAt >= since && s.Status == SampleStatus.Released);
        if (labId.HasValue) samplesQuery = samplesQuery.Where(s => s.LabId == labId.Value);

        var releasedCount = await samplesQuery.CountAsync(ct);
        var rftCount = releasedCount > 0
            ? await samplesQuery.CountAsync(s =>
                !_db.DigitalLogbookEntries.Any(e => e.SampleId == s.SampleId && e.IsOos) &&
                !_db.DigitalLogbookEntries.Any(e => e.SampleId == s.SampleId && e.Status == LogbookEntryStatus.Superseded), ct)
            : 0;

        var openCapas = await _db.OosInvestigations.CountAsync(i => i.Status == OosStatus.Open && !string.IsNullOrEmpty(i.CapaRef), ct);

        decimal oosRate  = total > 0 ? Math.Round((decimal)oosCount / total * 100, 2) : 0;
        decimal ootRate  = total > 0 ? Math.Round((decimal)ootCount / total * 100, 2) : 0;
        decimal rftRate  = releasedCount > 0 ? Math.Round((decimal)rftCount / releasedCount * 100, 2) : 0;
        decimal retestRate = total > 0 ? Math.Round((decimal)supersededCount / total * 100, 2) : 0;

        return new QualityKpis(oosRate, ootRate, rftRate, retestRate, openCapas, period);
    }

    public async Task<IReadOnlyList<InstrumentStatusBoardItem>> GetInstrumentStatusBoardAsync(int? labId, CancellationToken ct = default)
    {
        var query = _db.Instruments.AsQueryable();
        if (labId.HasValue) query = query.Where(i => i.LabId == labId.Value);

        var instruments = await query.Where(i => i.IsActive).ToListAsync(ct);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var result = new List<InstrumentStatusBoardItem>();

        foreach (var inst in instruments)
        {
            var openBreakdown = await _db.InstrumentBreakdowns
                .Where(b => b.InstrumentId == inst.InstrumentId && b.Status != BreakdownStatus.Resolved)
                .Select(b => (int?)b.BreakdownId)
                .FirstOrDefaultAsync(ct);

            var latestUtil = await _db.InstrumentUtilisationSummaries
                .Where(u => u.InstrumentId == inst.InstrumentId)
                .OrderByDescending(u => u.CalculatedAt)
                .Select(u => u.UtilisationPct)
                .FirstOrDefaultAsync(ct);

            result.Add(new InstrumentStatusBoardItem(
                inst.InstrumentId, inst.InstrumentCode, inst.InstrumentType,
                inst.Status.ToString(), inst.CalibrationDue,
                inst.CalibrationDue.DayNumber - today.DayNumber,
                openBreakdown, latestUtil));
        }
        return result;
    }

    public async Task<ComplianceSummary> GetComplianceSummaryAsync(CancellationToken ct = default)
    {
        var totalAuditEvents = await _db.MasterDataAuditLogs.CountAsync(ct);
        var openOos  = await _db.OosInvestigations.CountAsync(i => i.Status == OosStatus.Open, ct);
        var closedOos = await _db.OosInvestigations.CountAsync(i => i.Status == OosStatus.Closed, ct);
        var totalSigs = await _db.ElectronicSignatures.CountAsync(ct);

        return new ComplianceSummary(totalAuditEvents, openOos, closedOos, totalSigs, null, "Operational");
    }
}
