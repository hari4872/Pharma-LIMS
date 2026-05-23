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
    private readonly ILabContext _lab;

    public SpcController(ISpcService spc, ILabContext lab) { _spc = spc; _lab = lab; }

    // GET api/v1/spc/{parameterId}?points=50
    [HttpGet("{parameterId}")]
    public async Task<IActionResult> GetSpc(int parameterId, [FromQuery] int? labId, [FromQuery] int? points)
    {
        // Lab isolation: lab users always see their lab; cross-lab can specify labId
        var effectiveLabId = _lab.IsCrossLab ? labId : _lab.LabId;
        var result = await _spc.CalculateAsync(parameterId, effectiveLabId, points ?? 50);
        return Ok(result);
    }
}
