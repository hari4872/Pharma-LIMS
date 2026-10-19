using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OfficeOpenXml;
using OfficeOpenXml.Style;
using System.Drawing;

namespace LIMS.API.Controllers;

/// <summary>
/// Sprint 9 — Reporting Engine
/// Generates Excel exports for Samples, Results, CoAs, and Audit Trail.
/// Uses EPPlus 7 (non-commercial license for labs with &lt;5 users — verify commercial license if needed).
/// Route: api/v1/reports
/// </summary>
[ApiController]
[Route("api/v1/reports")]
[Authorize]
public class ReportsController : ControllerBase
{
    private readonly ILimsDbContext _db;
    private readonly ILabContext _lab;
    private readonly ISiteAnalyticsService _siteAnalytics;

    public ReportsController(ILimsDbContext db, ILabContext lab, ISiteAnalyticsService siteAnalytics)
    { _db = db; _lab = lab; _siteAnalytics = siteAnalytics; }

    // GET api/v1/reports/samples?from=2026-01-01&to=2026-12-31&status=Released
    [HttpGet("samples")]
    public async Task<IActionResult> ExportSamples(
        [FromQuery] DateTime? from, [FromQuery] DateTime? to,
        [FromQuery] string? status, [FromQuery] int? labId)
    {
        var labNames = await _db.Laboratories.ToDictionaryAsync(l => l.LabId, l => l.LabName);
        var q = _db.Samples
            .Include(s => s.Material)
            .Include(s => s.SampleTypeNav)
            .AsQueryable();

        if (!_lab.IsCrossLab && _lab.LabId.HasValue)
            q = q.Where(s => s.LabId == _lab.LabId);
        else if (labId.HasValue)
            q = q.Where(s => s.LabId == labId);

        if (from.HasValue)  q = q.Where(s => s.CreatedAt >= DateTime.SpecifyKind(from.Value.Date, DateTimeKind.Utc));
        if (to.HasValue)    q = q.Where(s => s.CreatedAt <= DateTime.SpecifyKind(to.Value.Date.AddDays(1), DateTimeKind.Utc));
        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<SampleStatus>(status, true, out var sampleStatusEnum))
            q = q.Where(s => s.Status == sampleStatusEnum);

        var samples = await q.OrderByDescending(s => s.CreatedAt).ToListAsync();

        ExcelPackage.LicenseContext = LicenseContext.NonCommercial;
        using var package = new ExcelPackage();
        var ws = package.Workbook.Worksheets.Add("Samples");

        // Header row
        var headers = new[] { "Sample No.", "Material", "Lot Number", "Batch/External Ref", "Sample Type", "Status", "Lab", "Received Date", "Due Date" };
        for (int col = 1; col <= headers.Length; col++)
        {
            ws.Cells[1, col].Value = headers[col - 1];
            ws.Cells[1, col].Style.Font.Bold = true;
            ws.Cells[1, col].Style.Fill.PatternType = ExcelFillStyle.Solid;
            ws.Cells[1, col].Style.Fill.BackgroundColor.SetColor(Color.FromArgb(13, 110, 110));
            ws.Cells[1, col].Style.Font.Color.SetColor(Color.White);
        }

        // Data rows
        for (int row = 0; row < samples.Count; row++)
        {
            var s = samples[row];
            int r = row + 2;
            ws.Cells[r, 1].Value = s.SampleNumber;
            ws.Cells[r, 2].Value = s.Material?.MaterialName ?? "Unknown";
            ws.Cells[r, 3].Value = s.LotNumber;
            ws.Cells[r, 4].Value = s.ExternalBatchId ?? "";
            ws.Cells[r, 5].Value = s.SampleTypeNav?.TypeName;
            ws.Cells[r, 6].Value = s.Status.ToString();
            ws.Cells[r, 7].Value = labNames.GetValueOrDefault(s.LabId, $"Lab {s.LabId}");
            ws.Cells[r, 8].Value = s.CreatedAt.ToLocalTime().ToString("yyyy-MM-dd");
            ws.Cells[r, 9].Value = s.DueDate.HasValue ? s.DueDate.Value.ToLocalTime().ToString("yyyy-MM-dd") : "";
        }

        ws.Cells[ws.Dimension.Address].AutoFitColumns();
        ws.Cells[1, 1, 1, headers.Length].AutoFitColumns();

        // Add title
        ws.HeaderFooter.OddHeader.CenteredText = $"Pharma LIMS — Sample Register Export {DateTime.UtcNow:yyyy-MM-dd}";

        var bytes = await package.GetAsByteArrayAsync();
        return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            $"LIMS_Samples_{DateTime.UtcNow:yyyyMMdd}.xlsx");
    }

    // GET api/v1/reports/results?from=2026-01-01&to=2026-12-31
    [HttpGet("results")]
    public async Task<IActionResult> ExportResults(
        [FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery] int? labId)
    {
        var q = _db.DigitalLogbookEntries
            .Include(e => e.Execution).ThenInclude(ex => ex.Sample).ThenInclude(s => s.Material)
            .Include(e => e.Parameter)
            .Include(e => e.Analyst)
            .AsQueryable();

        if (!_lab.IsCrossLab && _lab.LabId.HasValue)
            q = q.Where(e => e.Execution.Sample.LabId == _lab.LabId);
        else if (labId.HasValue)
            q = q.Where(e => e.Execution.Sample.LabId == labId);

        if (from.HasValue) q = q.Where(e => e.CreatedAt >= DateTime.SpecifyKind(from.Value.Date, DateTimeKind.Utc));
        if (to.HasValue)   q = q.Where(e => e.CreatedAt <= DateTime.SpecifyKind(to.Value.Date.AddDays(1), DateTimeKind.Utc));

        var entries = await q.OrderByDescending(e => e.CreatedAt).Take(5000).ToListAsync();

        ExcelPackage.LicenseContext = LicenseContext.NonCommercial;
        using var package = new ExcelPackage();
        var ws = package.Workbook.Worksheets.Add("Results");

        var headers = new[] { "Sample No.", "Material", "Parameter", "Raw Value", "Calculated Result", "UOM", "Pass/Fail", "OOS", "OOT", "Analyst", "Signed", "Date" };
        for (int col = 1; col <= headers.Length; col++)
        {
            ws.Cells[1, col].Value = headers[col - 1];
            ws.Cells[1, col].Style.Font.Bold = true;
            ws.Cells[1, col].Style.Fill.PatternType = ExcelFillStyle.Solid;
            ws.Cells[1, col].Style.Fill.BackgroundColor.SetColor(Color.FromArgb(13, 110, 110));
            ws.Cells[1, col].Style.Font.Color.SetColor(Color.White);
        }

        for (int row = 0; row < entries.Count; row++)
        {
            var e = entries[row];
            int r = row + 2;
            ws.Cells[r, 1].Value  = e.Execution?.Sample?.SampleNumber ?? "";
            ws.Cells[r, 2].Value  = e.Execution?.Sample?.Material?.MaterialName ?? "Unknown";
            ws.Cells[r, 3].Value  = e.Parameter.ParameterName;
            ws.Cells[r, 4].Value  = e.RawValue;
            ws.Cells[r, 5].Value  = e.CalculatedResult.HasValue ? (object)e.CalculatedResult.Value : "";
            ws.Cells[r, 6].Value  = e.Parameter.Uom;
            ws.Cells[r, 7].Value  = e.PassFail;
            ws.Cells[r, 8].Value  = e.IsOos ? "YES" : "NO";
            ws.Cells[r, 9].Value  = e.IsOot ? "YES" : "NO";
            ws.Cells[r, 10].Value = e.Analyst?.FullName ?? "Unknown";
            ws.Cells[r, 11].Value = e.Status.ToString();
            ws.Cells[r, 12].Value = e.CreatedAt.ToLocalTime().ToString("yyyy-MM-dd HH:mm");

            if (e.IsOos) ws.Cells[r, 8].Style.Font.Color.SetColor(Color.Red);
            if (e.IsOot) ws.Cells[r, 9].Style.Font.Color.SetColor(Color.Orange);
        }

        ws.Cells[ws.Dimension.Address].AutoFitColumns();
        ws.HeaderFooter.OddHeader.CenteredText = $"Pharma LIMS — Results Export {DateTime.UtcNow:yyyy-MM-dd}";

        var bytes = await package.GetAsByteArrayAsync();
        return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            $"LIMS_Results_{DateTime.UtcNow:yyyyMMdd}.xlsx");
    }

    // GET api/v1/reports/audit-trail?from=2026-01-01&entityType=Sample
    [HttpGet("audit-trail")]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> ExportAuditTrail(
        [FromQuery] DateTime? from, [FromQuery] DateTime? to,
        [FromQuery] string? entityType)
    {
        var q = _db.MasterDataAuditLogs.AsQueryable();
        if (from.HasValue) q = q.Where(a => a.PerformedAt >= DateTime.SpecifyKind(from.Value.Date, DateTimeKind.Utc));
        if (to.HasValue)   q = q.Where(a => a.PerformedAt <= DateTime.SpecifyKind(to.Value.Date.AddDays(1), DateTimeKind.Utc));
        if (!string.IsNullOrWhiteSpace(entityType)) q = q.Where(a => a.EntityType == entityType);

        var logs = await q.OrderByDescending(a => a.PerformedAt).Take(5000).ToListAsync();

        ExcelPackage.LicenseContext = LicenseContext.NonCommercial;
        using var package = new ExcelPackage();
        var ws = package.Workbook.Worksheets.Add("Audit Trail");

        var headers = new[] { "Entity Type", "Entity ID", "Event Type", "Performed By", "Old Value", "New Value", "Timestamp" };
        for (int col = 1; col <= headers.Length; col++)
        {
            ws.Cells[1, col].Value = headers[col - 1];
            ws.Cells[1, col].Style.Font.Bold = true;
            ws.Cells[1, col].Style.Fill.PatternType = ExcelFillStyle.Solid;
            ws.Cells[1, col].Style.Fill.BackgroundColor.SetColor(Color.FromArgb(13, 110, 110));
            ws.Cells[1, col].Style.Font.Color.SetColor(Color.White);
        }

        for (int row = 0; row < logs.Count; row++)
        {
            var a = logs[row];
            int r = row + 2;
            ws.Cells[r, 1].Value = a.EntityType;
            ws.Cells[r, 2].Value = a.EntityId;
            ws.Cells[r, 3].Value = a.EventType;
            ws.Cells[r, 4].Value = a.PerformedBy;
            ws.Cells[r, 5].Value = a.OldValue;
            ws.Cells[r, 6].Value = a.NewValue;
            ws.Cells[r, 7].Value = a.PerformedAt.ToLocalTime().ToString("yyyy-MM-dd HH:mm:ss");
        }

        ws.Cells[ws.Dimension.Address].AutoFitColumns();
        ws.HeaderFooter.OddHeader.CenteredText = $"Pharma LIMS — Audit Trail Export {DateTime.UtcNow:yyyy-MM-dd} (21 CFR Â§11.10(e))";

        var bytes = await package.GetAsByteArrayAsync();
        return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            $"LIMS_AuditTrail_{DateTime.UtcNow:yyyyMMdd}.xlsx");
    }

    // GET api/v1/reports/multi-site-summary?periodDays=30
    // MS-3: Consolidated cross-site Excel report — Admin / LabManager only
    [HttpGet("multi-site-summary")]
    [Authorize(Roles = "Admin,LabManager")]
    public async Task<IActionResult> ExportMultiSiteSummary([FromQuery] int? periodDays, CancellationToken ct)
    {
        var kpis = await _siteAnalytics.GetSiteKpisAsync(periodDays ?? 30, ct);
        var tat  = await _siteAnalytics.GetTatBreakdownAsync(periodDays ?? 30, ct);

        ExcelPackage.LicenseContext = LicenseContext.NonCommercial;
        using var package = new ExcelPackage();

        // â"€â"€ Sheet 1: Site KPI Summary â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
        var ws1 = package.Workbook.Worksheets.Add("Site KPI Summary");
        var headers1 = new[] {
            "Lab", "Site", "Location", "Type",
            "Total Samples", "Registered", "Pending Testing", "In Testing",
            "Pending QA", "Released", "Rejected",
            "OOS Count", "OOS Rate %", "Open CAPA", "Overdue",
            "Avg TAT (days)", "Release Rate %", "Pending Transfers"
        };
        for (int col = 1; col <= headers1.Length; col++)
        {
            ws1.Cells[1, col].Value = headers1[col - 1];
            ws1.Cells[1, col].Style.Font.Bold = true;
            ws1.Cells[1, col].Style.Fill.PatternType = ExcelFillStyle.Solid;
            ws1.Cells[1, col].Style.Fill.BackgroundColor.SetColor(Color.FromArgb(13, 110, 110));
            ws1.Cells[1, col].Style.Font.Color.SetColor(Color.White);
        }
        for (int row = 0; row < kpis.Count; row++)
        {
            var k = kpis[row]; int r = row + 2;
            ws1.Cells[r, 1].Value  = k.LabName;
            ws1.Cells[r, 2].Value  = k.Site;
            ws1.Cells[r, 3].Value  = k.Location;
            ws1.Cells[r, 4].Value  = k.LabType;
            ws1.Cells[r, 5].Value  = k.TotalSamples;
            ws1.Cells[r, 6].Value  = k.Registered;
            ws1.Cells[r, 7].Value  = k.PendingTesting;
            ws1.Cells[r, 8].Value  = k.InTesting;
            ws1.Cells[r, 9].Value  = k.PendingQAReview;
            ws1.Cells[r, 10].Value = k.Released;
            ws1.Cells[r, 11].Value = k.Rejected;
            ws1.Cells[r, 12].Value = k.OosCount;
            ws1.Cells[r, 13].Value = k.OosRatePct;
            ws1.Cells[r, 14].Value = k.OpenCapa;
            ws1.Cells[r, 15].Value = k.OverdueSamples;
            ws1.Cells[r, 16].Value = k.AvgTatDays;
            ws1.Cells[r, 17].Value = k.ReleaseRatePct;
            ws1.Cells[r, 18].Value = k.PendingTransfers;
            if (k.OosRatePct > 5) ws1.Cells[r, 13].Style.Font.Color.SetColor(Color.Red);
            if (k.OverdueSamples > 0) ws1.Cells[r, 15].Style.Font.Color.SetColor(Color.OrangeRed);
        }
        ws1.Cells[ws1.Dimension.Address].AutoFitColumns();
        ws1.HeaderFooter.OddHeader.CenteredText = $"Pharma LIMS — Multi-Site Summary {DateTime.UtcNow:yyyy-MM-dd}";

        // â"€â"€ Sheet 2: TAT Breakdown â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
        var ws2 = package.Workbook.Worksheets.Add("TAT Breakdown");
        var headers2 = new[] { "Lab", "Min TAT (days)", "Avg TAT (days)", "Max TAT (days)", "Released Samples" };
        for (int col = 1; col <= headers2.Length; col++)
        {
            ws2.Cells[1, col].Value = headers2[col - 1];
            ws2.Cells[1, col].Style.Font.Bold = true;
            ws2.Cells[1, col].Style.Fill.PatternType = ExcelFillStyle.Solid;
            ws2.Cells[1, col].Style.Fill.BackgroundColor.SetColor(Color.FromArgb(13, 110, 110));
            ws2.Cells[1, col].Style.Font.Color.SetColor(Color.White);
        }
        for (int row = 0; row < tat.Count; row++)
        {
            var t2 = tat[row]; int r = row + 2;
            ws2.Cells[r, 1].Value = t2.LabName;
            ws2.Cells[r, 2].Value = t2.MinDays;
            ws2.Cells[r, 3].Value = t2.AvgDays;
            ws2.Cells[r, 4].Value = t2.MaxDays;
            ws2.Cells[r, 5].Value = t2.SampleCount;
        }
        ws2.Cells[ws2.Dimension.Address].AutoFitColumns();

        var bytes = await package.GetAsByteArrayAsync();
        return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            $"LIMS_MultiSite_{DateTime.UtcNow:yyyyMMdd}.xlsx");
    }

    // ── Environmental Monitoring Reports ─────────────────────────────────────

    // GET api/v1/reports/em-job-status?from=2026-01-01&to=2026-12-31
    [HttpGet("em-job-status")]
    public async Task<IActionResult> ExportEmJobStatus(
        [FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var fromDt = from.HasValue ? DateOnly.FromDateTime(from.Value) : DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-30));
        var toDt   = to.HasValue   ? DateOnly.FromDateTime(to.Value)   : DateOnly.FromDateTime(DateTime.UtcNow);

        var rows = await _db.ProcessLogRows
            .Include(r => r.Checkpoint)
            .Where(r => r.Checkpoint.Category == "Environmental"
                     && r.SlotTime.Date >= fromDt.ToDateTime(TimeOnly.MinValue)
                     && r.SlotTime.Date <= toDt.ToDateTime(TimeOnly.MaxValue))
            .OrderBy(r => r.SlotTime)
            .ToListAsync();

        // Build pivot: location (from SlotLabel) × date
        var dates     = rows.Select(r => DateOnly.FromDateTime(r.SlotTime.DateTime)).Distinct().OrderBy(d => d).ToList();
        var checkpoints = rows.Select(r => r.Checkpoint).DistinctBy(c => c.CheckpointId).OrderBy(c => c.CheckpointCode).ToList();

        ExcelPackage.LicenseContext = LicenseContext.NonCommercial;
        using var package = new ExcelPackage();
        var ws = package.Workbook.Worksheets.Add("EM Job Status");

        // Header: Checkpoint | SystemName | date1 | date2 | …
        ws.Cells[1, 1].Value = "Checkpoint"; ws.Cells[1, 2].Value = "System / Area";
        for (int d = 0; d < dates.Count; d++)
        {
            ws.Cells[1, d + 3].Value = dates[d].ToString("dd-MMM");
            ws.Cells[1, d + 3].Style.Font.Bold = true;
        }
        StyleHeader(ws, 1, dates.Count + 2, Color.FromArgb(15, 110, 86));

        var rowIdx = 2;
        foreach (var cp in checkpoints)
        {
            ws.Cells[rowIdx, 1].Value = cp.CheckpointCode;
            ws.Cells[rowIdx, 2].Value = cp.SystemName ?? "—";
            for (int d = 0; d < dates.Count; d++)
            {
                var row = rows.FirstOrDefault(r => r.CheckpointId == cp.CheckpointId
                    && DateOnly.FromDateTime(r.SlotTime.DateTime) == dates[d]);
                if (row == null) { ws.Cells[rowIdx, d + 3].Value = "—"; continue; }
                var cell = ws.Cells[rowIdx, d + 3];
                if (row.Status == "Locked" || row.Status == "Signed") { cell.Value = "Done";   cell.Style.Font.Color.SetColor(Color.FromArgb(15, 110, 86)); }
                else if (row.Status == "Open" && row.SlotTime < DateTimeOffset.UtcNow.AddHours(-4)) { cell.Value = "Late";   cell.Style.Font.Color.SetColor(Color.OrangeRed); }
                else { cell.Value = "Open"; }
            }
            rowIdx++;
        }
        ws.Cells[ws.Dimension.Address].AutoFitColumns();
        ws.HeaderFooter.OddHeader.CenteredText = $"LIMS — EM Job Status {DateTime.UtcNow:yyyy-MM-dd}";

        var bytes = await package.GetAsByteArrayAsync();
        return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            $"LIMS_EM_JobStatus_{DateTime.UtcNow:yyyyMMdd}.xlsx");
    }

    // GET api/v1/reports/em-sampling-report?from=2026-01-01&to=2026-12-31
    [HttpGet("em-sampling-report")]
    public async Task<IActionResult> ExportEmSamplingReport(
        [FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var fromDt = from ?? DateTime.UtcNow.AddDays(-30);
        var toDt   = (to ?? DateTime.UtcNow).AddDays(1);

        var readings = await _db.ProcessLogReadings
            .Include(rd => rd.Row).ThenInclude(row => row.Checkpoint)
            .Include(rd => rd.Parameter)
            .Where(rd => rd.Row.Checkpoint.Category == "Environmental"
                      && rd.RecordedAt >= fromDt && rd.RecordedAt < toDt)
            .OrderBy(rd => rd.RecordedAt)
            .ToListAsync();

        ExcelPackage.LicenseContext = LicenseContext.NonCommercial;
        using var package = new ExcelPackage();
        var ws = package.Workbook.Worksheets.Add("EM Sampling Report");

        var headers = new[] { "Date", "Checkpoint", "System / Area", "Slot", "Parameter", "Value", "Unit", "Limit Status", "Recorded By", "Row Status" };
        for (int c = 1; c <= headers.Length; c++) ws.Cells[1, c].Value = headers[c - 1];
        StyleHeader(ws, 1, headers.Length, Color.FromArgb(6, 95, 70));

        int row = 2;
        foreach (var rd in readings)
        {
            var cp = rd.Row.Checkpoint;
            ws.Cells[row, 1].Value = rd.RecordedAt.ToLocalTime().ToString("yyyy-MM-dd");
            ws.Cells[row, 2].Value = cp.CheckpointCode;
            ws.Cells[row, 3].Value = cp.SystemName ?? "—";
            ws.Cells[row, 4].Value = rd.Row.SlotLabel;
            ws.Cells[row, 5].Value = rd.Parameter?.ParameterName ?? $"Param {rd.ParameterId}";
            ws.Cells[row, 6].Value = rd.Value;
            ws.Cells[row, 7].Value = rd.Parameter?.Uom ?? "";
            ws.Cells[row, 8].Value = "—";   // limit evaluation TBD per-parameter
            ws.Cells[row, 9].Value = rd.RecordedBy;
            ws.Cells[row, 10].Value = rd.Row.Status;
            row++;
        }
        ws.Cells[ws.Dimension?.Address ?? "A1:J1"].AutoFitColumns();
        ws.HeaderFooter.OddHeader.CenteredText = $"LIMS — EM Sampling Report {DateTime.UtcNow:yyyy-MM-dd}";

        var bytes = await package.GetAsByteArrayAsync();
        return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            $"LIMS_EM_Sampling_{DateTime.UtcNow:yyyyMMdd}.xlsx");
    }

    // GET api/v1/reports/em-trend?from=2026-01-01&to=2026-12-31
    [HttpGet("em-trend")]
    public async Task<IActionResult> ExportEmTrend(
        [FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var fromDt = from ?? DateTime.UtcNow.AddDays(-90);
        var toDt   = (to ?? DateTime.UtcNow).AddDays(1);

        var readings = await _db.ProcessLogReadings
            .Include(rd => rd.Row).ThenInclude(row => row.Checkpoint)
                .ThenInclude(cp => cp.CheckpointParameters)
            .Include(rd => rd.Parameter)
            .Where(rd => rd.Row.Checkpoint.Category == "Environmental"
                      && rd.RecordedAt >= fromDt && rd.RecordedAt < toDt)
            .OrderBy(rd => rd.Row.Checkpoint.CheckpointCode)
            .ThenBy(rd => rd.RecordedAt)
            .ToListAsync();

        ExcelPackage.LicenseContext = LicenseContext.NonCommercial;
        using var package = new ExcelPackage();

        // One sheet per checkpoint
        foreach (var group in readings.GroupBy(rd => rd.Row.Checkpoint.CheckpointId))
        {
            var cp = group.First().Row.Checkpoint;
            var sheetName = (cp.SystemName ?? cp.CheckpointCode)[..Math.Min(31, (cp.SystemName ?? cp.CheckpointCode).Length)];
            var ws = package.Workbook.Worksheets.Add(sheetName);

            var headers = new[] { "Date/Time", "Slot", "Parameter", "Value", "Alert Min", "Alert Max", "Action Min", "Action Max", "Status" };
            for (int c = 1; c <= headers.Length; c++) ws.Cells[1, c].Value = headers[c - 1];
            StyleHeader(ws, 1, headers.Length, Color.FromArgb(29, 158, 117));

            int row = 2;
            foreach (var rd in group)
            {
                var limits = cp.CheckpointParameters.FirstOrDefault(p => p.ParameterId == rd.ParameterId);
                ws.Cells[row, 1].Value = rd.RecordedAt.ToLocalTime().ToString("yyyy-MM-dd HH:mm");
                ws.Cells[row, 2].Value = rd.Row.SlotLabel;
                ws.Cells[row, 3].Value = rd.Parameter?.ParameterName ?? $"Param {rd.ParameterId}";
                ws.Cells[row, 4].Value = rd.Value;
                ws.Cells[row, 5].Value = (object?)limits?.AlertMin ?? "—";
                ws.Cells[row, 6].Value = (object?)limits?.AlertMax ?? "—";
                ws.Cells[row, 7].Value = (object?)limits?.ActionMin ?? "—";
                ws.Cells[row, 8].Value = (object?)limits?.ActionMax ?? "—";
                if (decimal.TryParse(rd.Value, out var v))
                {
                    var isAction = (limits?.ActionMin.HasValue == true && v < limits.ActionMin) || (limits?.ActionMax.HasValue == true && v > limits.ActionMax);
                    var isAlert  = (limits?.AlertMin.HasValue  == true && v < limits.AlertMin)  || (limits?.AlertMax.HasValue  == true && v > limits.AlertMax);
                    ws.Cells[row, 9].Value = isAction ? "Action" : isAlert ? "Alert" : "Normal";
                    if (isAction) ws.Cells[row, 9].Style.Font.Color.SetColor(Color.Red);
                    else if (isAlert) ws.Cells[row, 9].Style.Font.Color.SetColor(Color.OrangeRed);
                    else ws.Cells[row, 9].Style.Font.Color.SetColor(Color.FromArgb(15, 110, 86));
                }
                row++;
            }
            ws.Cells[ws.Dimension?.Address ?? "A1:I1"].AutoFitColumns();
        }

        if (package.Workbook.Worksheets.Count == 0)
            package.Workbook.Worksheets.Add("No EM Data").Cells[1, 1].Value = "No EM readings found for the selected date range.";

        var bytes = await package.GetAsByteArrayAsync();
        return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            $"LIMS_EM_Trend_{DateTime.UtcNow:yyyyMMdd}.xlsx");
    }

    private static void StyleHeader(ExcelWorksheet ws, int row, int colCount, Color bg)
    {
        for (int c = 1; c <= colCount; c++)
        {
            ws.Cells[row, c].Style.Font.Bold = true;
            ws.Cells[row, c].Style.Fill.PatternType = ExcelFillStyle.Solid;
            ws.Cells[row, c].Style.Fill.BackgroundColor.SetColor(bg);
            ws.Cells[row, c].Style.Font.Color.SetColor(Color.White);
        }
    }
}

