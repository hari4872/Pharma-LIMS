using LIMS.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LIMS.API.Controllers;

/// <summary>
/// MS-4: Cross-site analytics — SuperAdmin / CorporateQA only.
/// Route: api/v1/site-analytics
/// </summary>
[ApiController]
[Route("api/v1/site-analytics")]
[Authorize]
public class SiteAnalyticsController : ControllerBase
{
    private readonly ISiteAnalyticsService _svc;
    private readonly ILabContext _lab;

    public SiteAnalyticsController(ISiteAnalyticsService svc, ILabContext lab)
    { _svc = svc; _lab = lab; }

    // GET api/v1/site-analytics/kpis?periodDays=30
    [HttpGet("kpis")]
    [Authorize(Roles = "Admin,SuperAdmin,CorporateQA")]
    public async Task<IActionResult> GetKpis([FromQuery] int? periodDays, CancellationToken ct)
        => Ok(await _svc.GetSiteKpisAsync(periodDays ?? 30, ct));

    // GET api/v1/site-analytics/tat?periodDays=30
    [HttpGet("tat")]
    [Authorize(Roles = "Admin,SuperAdmin,CorporateQA")]
    public async Task<IActionResult> GetTat([FromQuery] int? periodDays, CancellationToken ct)
        => Ok(await _svc.GetTatBreakdownAsync(periodDays ?? 30, ct));

    // GET api/v1/site-analytics/oos-trend?weeks=8
    [HttpGet("oos-trend")]
    [Authorize(Roles = "Admin,SuperAdmin,CorporateQA")]
    public async Task<IActionResult> GetOosTrend([FromQuery] int? weeks, CancellationToken ct)
        => Ok(await _svc.GetOosTrendAsync(weeks ?? 8, ct));
}
