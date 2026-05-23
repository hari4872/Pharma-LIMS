using LIMS.Application.Interfaces;
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

    public ReportsController(ILimsDbContext db, ILabContext lab) { _db = db; _lab = lab; }

    // GET api/v1/reports/samples?from=2026-01-01&to=2026-12-31&status=Released
    [HttpGet("samples")]
    public async Task<IActionResult> ExportSamples(
        [FromQuery] DateTime? from, [FromQuery] DateTime? to,
        [FromQuery] string? status, [FromQuery] int? labId)
    {
        var q = _db.Samples
            .Include(s => s.Material)
            .Include(s => s.SampleTypeNav)
            .Include(s => s.Lab)
            .AsQueryable();

        if (!_lab.IsCrossLab && _lab.LabId.HasValue)
            q = q.Where(s => s.LabId == _lab.LabId);
        else if (labId.HasValue)
            q = q.Where(s => s.LabId == labId);

        if (from.HasValue)  q = q.Where(s => s.CreatedAt >= from.Value);
        if (to.HasValue)    q = q.Where(s => s.CreatedAt <= to.Value.AddDays(1));
        if (!string.IsNullOrWhiteSpace(status))
            q = q.Where(s => s.Status.ToString() == status);

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
            ws.Cells[r, 2].Value = s.Material.MaterialName;
            ws.Cells[r, 3].Value = s.LotNumber;
            ws.Cells[r, 4].Value = s.ExternalBatchId ?? "";
            ws.Cells[r, 5].Value = s.SampleTypeNav?.TypeName;
            ws.Cells[r, 6].Value = s.Status.ToString();
            ws.Cells[r, 7].Value = s.Lab?.LabName;
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
            .Include(e => e.Execution).ThenInclude(ex => ex.Sample).ThenInclude(s => s.Lab)
            .Include(e => e.Execution).ThenInclude(ex => ex.Sample).ThenInclude(s => s.Material)
            .Include(e => e.Parameter)
            .Include(e => e.Analyst)
            .AsQueryable();

        if (!_lab.IsCrossLab && _lab.LabId.HasValue)
            q = q.Where(e => e.Execution.Sample.LabId == _lab.LabId);
        else if (labId.HasValue)
            q = q.Where(e => e.Execution.Sample.LabId == labId);

        if (from.HasValue) q = q.Where(e => e.CreatedAt >= from.Value);
        if (to.HasValue)   q = q.Where(e => e.CreatedAt <= to.Value.AddDays(1));

        var entries = await q.OrderByDescending(e => e.CreatedAt).Take(10000).ToListAsync();

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
            ws.Cells[r, 1].Value  = e.Execution.Sample.SampleNumber;
            ws.Cells[r, 2].Value  = e.Execution.Sample.Material.MaterialName;
            ws.Cells[r, 3].Value  = e.Parameter.ParameterName;
            ws.Cells[r, 4].Value  = e.RawValue;
            ws.Cells[r, 5].Value  = e.CalculatedResult.HasValue ? (object)e.CalculatedResult.Value : "";
            ws.Cells[r, 6].Value  = e.Parameter.Uom;
            ws.Cells[r, 7].Value  = e.PassFail;
            ws.Cells[r, 8].Value  = e.IsOos ? "YES" : "NO";
            ws.Cells[r, 9].Value  = e.IsOot ? "YES" : "NO";
            ws.Cells[r, 10].Value = e.Analyst.FullName;
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
        if (from.HasValue) q = q.Where(a => a.PerformedAt >= from.Value);
        if (to.HasValue)   q = q.Where(a => a.PerformedAt <= to.Value.AddDays(1));
        if (!string.IsNullOrWhiteSpace(entityType)) q = q.Where(a => a.EntityType == entityType);

        var logs = await q.OrderByDescending(a => a.PerformedAt).Take(20000).ToListAsync();

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
        ws.HeaderFooter.OddHeader.CenteredText = $"Pharma LIMS — Audit Trail Export {DateTime.UtcNow:yyyy-MM-dd} (21 CFR §11.10(e))";

        var bytes = await package.GetAsByteArrayAsync();
        return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            $"LIMS_AuditTrail_{DateTime.UtcNow:yyyyMMdd}.xlsx");
    }
}
