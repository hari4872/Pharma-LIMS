using LIMS.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LIMS.API.Controllers;

// FR-10 / FR-11: Dashboard — all metrics server-side (Contract 2)
// Contract 1: IDashboardAggregationService is the single aggregation source
[ApiController]
[Route("api/v1/dashboard")]
[Authorize]
public class DashboardController : ControllerBase
{
    private readonly IDashboardAggregationService _svc;
    public DashboardController(IDashboardAggregationService svc) => _svc = svc;

    // GET api/v1/dashboard/wip?labId=1
    [HttpGet("wip")]
    public async Task<IActionResult> GetWip([FromQuery] int? labId, CancellationToken ct)
        => Ok(await _svc.GetWipSummaryAsync(labId, ct));

    // GET api/v1/dashboard/tat?labId=1&periodDays=30
    [HttpGet("tat")]
    public async Task<IActionResult> GetTat([FromQuery] int? labId, [FromQuery] int? periodDays, CancellationToken ct)
        => Ok(await _svc.GetTatSummaryAsync(labId, periodDays, ct));

    // GET api/v1/dashboard/quality-kpis?labId=1&periodDays=30
    [HttpGet("quality-kpis")]
    public async Task<IActionResult> GetQualityKpis([FromQuery] int? labId, [FromQuery] int? periodDays, CancellationToken ct)
        => Ok(await _svc.GetQualityKpisAsync(labId, periodDays, ct));

    // GET api/v1/dashboard/instrument-board?labId=1
    [HttpGet("instrument-board")]
    public async Task<IActionResult> GetInstrumentBoard([FromQuery] int? labId, CancellationToken ct)
        => Ok(await _svc.GetInstrumentStatusBoardAsync(labId, ct));

    // GET api/v1/dashboard/compliance — QA/Admin only
    [HttpGet("compliance")]
    [Authorize(Roles = "QA,Admin")]
    public async Task<IActionResult> GetCompliance(CancellationToken ct)
        => Ok(await _svc.GetComplianceSummaryAsync(ct));

    // GET api/v1/dashboard/coa-history?labId=1&periodDays=30 — vw_coa_history (Dashboards §6)
    [HttpGet("coa-history")]
    public async Task<IActionResult> GetCoaHistory([FromQuery] int? labId, [FromQuery] int? periodDays, CancellationToken ct)
        => Ok(await _svc.GetCoaHistoryAsync(labId, periodDays, ct));

    // GET api/v1/dashboard/sample-pipeline — samples by status (for pipeline bar chart)
    [HttpGet("sample-pipeline")]
    public async Task<IActionResult> GetSamplePipeline([FromQuery] int? labId, CancellationToken ct)
        => Ok(await _svc.GetSamplePipelineAsync(labId, ct));

    // GET api/v1/dashboard/sample-trend?days=14 — daily registrations trend
    [HttpGet("sample-trend")]
    public async Task<IActionResult> GetSampleTrend([FromQuery] int? labId, [FromQuery] int? days, CancellationToken ct)
        => Ok(await _svc.GetSampleTrendAsync(labId, days ?? 14, ct));

    // GET api/v1/dashboard/oos-trend?days=30 — daily OOS rate trend
    [HttpGet("oos-trend")]
    public async Task<IActionResult> GetOosTrend([FromQuery] int? labId, [FromQuery] int? days, CancellationToken ct)
        => Ok(await _svc.GetOosTrendAsync(labId, days ?? 30, ct));
}
