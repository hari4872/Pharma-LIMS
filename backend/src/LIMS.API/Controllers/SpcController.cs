using LIMS.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

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

    public SpcController(ISpcService spc, IQcChartService qc, ILabContext lab) { _spc = spc; _qc = qc; _lab = lab; }

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
}
