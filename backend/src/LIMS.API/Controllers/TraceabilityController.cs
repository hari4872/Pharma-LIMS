using LIMS.Application.Features.Traceability;
using LIMS.Application.Interfaces;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LIMS.API.Controllers;

[ApiController]
[Route("api/v1/traceability")]
[Authorize]
public class TraceabilityController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly ILimsDbContext _db;
    public TraceabilityController(IMediator mediator, ILimsDbContext db)
    { _mediator = mediator; _db = db; }

    // GET api/v1/traceability/samples/{sampleId}/graph
    // FR-01..FR-03, FR-08, FR-09: full bidirectional traceability graph
    [HttpGet("samples/{sampleId:int}/graph")]
    public async Task<IActionResult> GetGraph(int sampleId)
    {
        var userId = int.Parse(User.FindFirst("sub")?.Value ?? "0");
        var result = await _mediator.Send(new GetTraceabilityGraphQuery(sampleId, userId));
        if (!result.IsSuccess) return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return Ok(result.Value);
    }

    // GET api/v1/traceability/recall?lotNumber=LOT001
    // FR-12: recall scope query — all affected downstream batches from lot node
    [HttpGet("recall")]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> GetRecallScope(
        [FromQuery] string lotNumber,
        [FromQuery] string? batch,
        [FromQuery] DateTimeOffset? dateFrom,
        [FromQuery] DateTimeOffset? dateTo,
        [FromQuery] int? analystId,
        [FromQuery] int? instrumentId)
    {
        var userId = int.Parse(User.FindFirst("sub")?.Value ?? "0");
        var result = await _mediator.Send(new GetRecallScopeQuery(lotNumber, userId, batch, dateFrom, dateTo, analystId, instrumentId));
        if (!result.IsSuccess) return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return Ok(new { lotNumber, affectedSampleIds = result.Value, count = result.Value?.Count });
    }

    // POST api/v1/traceability/sampling-events
    // FR-09: log sampling event (upstream traceability node)
    [HttpPost("sampling-events")]
    public async Task<IActionResult> LogSamplingEvent([FromBody] LogSamplingEventRequest request)
    {
        var result = await _mediator.Send(new LogSamplingEventCommand(
            request.SampleId, request.SampledById, request.SampledAt,
            request.Location, request.QuantityTaken, request.QuantityUom,
            request.ContainerId, request.Notes));
        if (!result.IsSuccess) return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return CreatedAtAction(nameof(GetGraph), new { sampleId = request.SampleId }, new { samplingEventId = result.Value });
    }

    // GET api/v1/traceability/complaints-deviations?sampleId=5
    [HttpGet("complaints-deviations")]
    public async Task<IActionResult> ListComplaintsDeviations([FromQuery] int? sampleId)
    {
        var q = _db.ComplaintsDeviations.AsQueryable();
        if (sampleId.HasValue) q = q.Where(x => x.SampleId == sampleId.Value);
        var list = await q.OrderByDescending(x => x.OpenedAt)
            .Select(x => new {
                x.CdId, x.SampleId,
                CdType    = x.CdType.ToString(),
                x.CdReference, x.Description,
                x.LinkedOosId, x.Status,
                CreatedAt = x.OpenedAt
            })
            .ToListAsync();
        return Ok(list);
    }

    // POST api/v1/traceability/complaints-deviations
    // FR-08: log complaint/deviation (downstream traceability node)
    [HttpPost("complaints-deviations")]
    [Authorize(Roles = "Admin,QA,QCLead")]
    public async Task<IActionResult> CreateComplaintsDeviation([FromBody] CreateCdRequest request)
    {
        var username = User.Identity?.Name ?? "Unknown";
        var result = await _mediator.Send(new CreateComplaintsDeviationCommand(
            request.SampleId, request.CdType, request.CdReference,
            request.Description, username, request.LinkedOosId));
        if (!result.IsSuccess) return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return CreatedAtAction(nameof(GetGraph), new { sampleId = request.SampleId }, new { cdId = result.Value });
    }

    // PUT api/v1/traceability/complaints-deviations/{id}/close
    [HttpPut("complaints-deviations/{id:int}/close")]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> CloseComplaintsDeviation(int id)
    {
        var username = User.Identity?.Name ?? "Unknown";
        var result = await _mediator.Send(new CloseComplaintsDeviationCommand(id, username));
        if (!result.IsSuccess) return result.ErrorCode == "NOT_FOUND" ? NotFound() : BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return Ok(new { cdId = result.Value, status = "Closed" });
    }
}

public record LogSamplingEventRequest(
    int SampleId, int SampledById, DateTimeOffset SampledAt,
    string? Location, decimal? QuantityTaken, string? QuantityUom,
    string? ContainerId, string? Notes);

public record CreateCdRequest(
    int SampleId, string CdType, string CdReference,
    string? Description, int? LinkedOosId);
