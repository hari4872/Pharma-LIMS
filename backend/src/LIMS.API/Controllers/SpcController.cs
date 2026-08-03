using LIMS.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LIMS.API.Controllers;

/// <summary>
/// Sprint 5 — SPC (Statistical Process Control) Controller
/// GET api/v1/spc/{parameterId}?labId=1&amp;points=50
/// Returns control chart data, capability indices, and Nelson rule violations.
/// </summary>
[ApiController]
[Route("api/v1/spc")]
[Authorize]
public class SpcController : ControllerBase
{
    private readonly ISpcService _spc;
    private readonly IQcChartService _qc;
    private readonly ILabContext _lab;
    private readonly ILimsDbContext _db;

    public SpcController(ISpcService spc, IQcChartService qc, ILabContext lab, ILimsDbContext db)
    { _spc = spc; _qc = qc; _lab = lab; _db = db; }

    // GET api/v1/spc/{parameterId}?points=50
    [HttpGet("{parameterId}")]
    public async Task<IActionResult> GetSpc(int parameterId, [FromQuery] int? labId, [FromQuery] int? points)
    {
        var effectiveLabId = _lab.IsCrossLab ? labId : _lab.LabId;
        var result = await _spc.CalculateAsync(parameterId, effectiveLabId, points ?? 50);
        return Ok(result);
    }

    // GET api/v1/spc/{parameterId}/qc-chart?points=50
    [HttpGet("{parameterId}/qc-chart")]
    public async Task<IActionResult> GetQcChart(int parameterId, [FromQuery] int? labId, [FromQuery] int? points, CancellationToken ct)
    {
        var effectiveLabId = _lab.IsCrossLab ? labId : _lab.LabId;
        var result = await _qc.GetChartAsync(parameterId, effectiveLabId, points ?? 50, ct);
        return Ok(result);
    }

    // GET api/v1/spc/batch?parameterIds=1,2,3&points=20
    // Returns SPC results for multiple parameters in one call — used by Work Queue inline badge.
    [HttpGet("batch")]
    public async Task<IActionResult> GetBatch(
        [FromQuery] string parameterIds,
        [FromQuery] int? labId,
        [FromQuery] int? points,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(parameterIds))
            return Ok(new Dictionary<int, SpcResult>());

        var ids = parameterIds
            .Split(',', StringSplitOptions.RemoveEmptyEntries)
            .Select(s => int.TryParse(s.Trim(), out var n) ? n : (int?)null)
            .Where(n => n.HasValue).Select(n => n!.Value).Distinct().ToList();

        var effectiveLabId = _lab.IsCrossLab ? labId : _lab.LabId;
        var results = new Dictionary<int, SpcResult>();
        foreach (var id in ids)
            results[id] = await _spc.CalculateAsync(id, effectiveLabId, points ?? 20, ct);

        return Ok(results);
    }

    // GET api/v1/spc/summary?points=20&limit=20
    // Returns process-health summary for the dashboard overview card.
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(
        [FromQuery] int? labId,
        [FromQuery] int? points,
        [FromQuery] int? limit,
        CancellationToken ct)
    {
        var effectiveLabId = _lab.IsCrossLab ? labId : _lab.LabId;
        var since = DateTimeOffset.UtcNow.AddDays(-30);

        var paramIds = await _db.DigitalLogbookEntries
            .Where(e => e.CalculatedResult.HasValue && e.CreatedAt >= since
                && (effectiveLabId == null || e.Execution.Sample.LabId == effectiveLabId))
            .Select(e => e.ParameterId)
            .Distinct()
            .Take(limit ?? 20)
            .ToListAsync(ct);

        int inControl = 0, trending = 0, oot = 0;
        var cpks = new List<double>();
        var flagged = new List<object>();

        foreach (var pid in paramIds)
        {
            var r = await _spc.CalculateAsync(pid, effectiveLabId, points ?? 20, ct);
            if (r.N < 5) { inControl++; continue; }
            if (!r.OutOfControl) { inControl++; }
            else if (r.Rules.Any(x => x.Contains("Rule 1"))) { oot++; flagged.Add(new { r.ParameterId, r.ParameterName, r.Rules, Status = "OOT" }); }
            else { trending++; flagged.Add(new { r.ParameterId, r.ParameterName, r.Rules, Status = "Trending" }); }
            if (r.Cpk.HasValue) cpks.Add(r.Cpk.Value);
        }

        return Ok(new {
            TotalTracked = paramIds.Count,
            InControl    = inControl,
            Trending     = trending,
            Oot          = oot,
            AvgCpk       = cpks.Count > 0 ? Math.Round(cpks.Average(), 3) : (double?)null,
            Flagged      = flagged,
        });
    }
}
