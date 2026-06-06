using LIMS.Application.Features.Stability;
using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LIMS.API.Controllers;

/// <summary>
/// ICH Q1A Stability Trending — linear regression + shelf-life prediction per parameter.
/// Route: api/v1/stability-trend
/// </summary>
[ApiController]
[Route("api/v1/stability-trend")]
[Authorize]
public class StabilityTrendController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly ILimsDbContext _db;

    public StabilityTrendController(IMediator mediator, ILimsDbContext db)
    { _mediator = mediator; _db = db; }

    // GET api/v1/stability-trend/{protocolId}/{parameterId}?condition=Accelerated
    [HttpGet("{protocolId:int}/{parameterId:int}")]
    public async Task<IActionResult> GetTrend(
        int protocolId, int parameterId,
        [FromQuery] string? condition)
    {
        StabilityStorageCondition? cond = null;
        if (!string.IsNullOrWhiteSpace(condition) &&
            Enum.TryParse<StabilityStorageCondition>(condition, true, out var parsed))
            cond = parsed;

        var report = await _mediator.Send(new GetStabilityTrendQuery(protocolId, parameterId, cond));
        return Ok(report);
    }

    // POST api/v1/stability-trend/record-pull-results — called after a pull is signed off
    // Records trend points for each parameter result in the pull
    [HttpPost("record-pull-results")]
    [Authorize(Roles = "Admin,QA,LabManager,Analyst")]
    public async Task<IActionResult> RecordPullResults([FromBody] RecordPullTrendRequest request)
    {
        var pull = await _db.StabilityPulls
            .Include(p => p.Sample)
            .FirstOrDefaultAsync(p => p.PullId == request.PullId);
        if (pull is null) return NotFound(new { error = "Pull not found." });

        // Resolve protocol + storage condition from the pull's sample
        var protocol = await _db.StabilityProtocols
            .FirstOrDefaultAsync(p => p.MaterialId == pull.Sample.MaterialId);
        if (protocol is null)
            return BadRequest(new { error = "No stability protocol found for this sample's material." });

        // Parse time point (T0, T3M, T6M, T12M, T24M → months)
        var months = ParseTimePointMonths(pull.TimePoint);

        var points = new List<StabilityTrendPoint>();
        foreach (var entry in request.Results)
        {
            points.Add(new StabilityTrendPoint
            {
                ProtocolId       = protocol.StabilityProtocolId,
                ParameterId      = entry.ParameterId,
                StorageCondition = protocol.StorageCondition,
                TimePointMonths  = months,
                MeasuredValue    = entry.MeasuredValue,
                PullId           = request.PullId,
                CreatedAt        = DateTimeOffset.UtcNow
            });
        }

        _db.StabilityTrendPoints.AddRange(points);
        await _db.SaveChangesAsync();

        // Flag if any parameter is ActionRequired
        var flags = new List<object>();
        foreach (var p in points)
        {
            var trend = await _mediator.Send(
                new GetStabilityTrendQuery(p.ProtocolId, p.ParameterId, p.StorageCondition));
            if (trend.Flag == TrendFlag.ActionRequired)
                flags.Add(new { p.ParameterId, trend.ParameterName, Flag = trend.Flag.ToString() });
        }

        return Ok(new {
            recordedCount = points.Count,
            actionRequiredFlags = flags
        });
    }

    private static int ParseTimePointMonths(string timePoint)
    {
        if (string.IsNullOrWhiteSpace(timePoint)) return 0;
        var t = timePoint.Trim().ToUpper();
        if (t == "T0" || t == "T=0") return 0;
        var numPart = t.Replace("T", "").Replace("M", "").Replace("=", "").Trim();
        return int.TryParse(numPart, out var m) ? m : 0;
    }
}

public record RecordPullTrendRequest(int PullId, List<PullParameterResult> Results);
public record PullParameterResult(int ParameterId, decimal MeasuredValue);
