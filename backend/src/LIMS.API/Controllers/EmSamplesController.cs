using LIMS.Application.Features.EmSamples;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LIMS.API.Controllers;

[ApiController]
[Route("api/v1/em-samples")]
[Authorize]
public class EmSamplesController : LimsControllerBase
{
    private readonly IMediator _mediator;
    public EmSamplesController(IMediator mediator) => _mediator = mediator;

    // GET api/v1/em-samples?checkpointId=&status=&from=&to=&resultStatus=
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] int? checkpointId,
        [FromQuery] string? status,
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to,
        [FromQuery] string? resultStatus)
        => Ok(await _mediator.Send(new GetEmSamplesQuery(checkpointId, status, from, to, resultStatus)));

    // POST api/v1/em-samples/generate?date=2026-10-19
    [HttpPost("generate")]
    [Authorize(Roles = "Admin,QA,Analyst")]
    public async Task<IActionResult> Generate([FromQuery] DateOnly? date)
    {
        var username = User.Identity?.Name ?? "Unknown";
        var targetDate = date ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var result = await _mediator.Send(new GenerateEmSamplesCommand(targetDate, username));
        if (!result.IsSuccess) return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return Ok(new { created = result.Value, date = targetDate.ToString("yyyy-MM-dd") });
    }

    // PATCH api/v1/em-samples/{id}/collect
    [HttpPatch("{id:int}/collect")]
    [Authorize(Roles = "Admin,QA,Analyst")]
    public async Task<IActionResult> Collect(int id)
    {
        var username = User.Identity?.Name ?? "Unknown";
        var result = await _mediator.Send(new CollectEmSampleCommand(id, username));
        if (!result.IsSuccess) return result.ErrorCode == "NOT_FOUND" ? NotFound() : BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return Ok(new { emSampleId = result.Value, status = "Collected" });
    }

    // PATCH api/v1/em-samples/{id}/receive
    [HttpPatch("{id:int}/receive")]
    [Authorize(Roles = "Admin,QA,Analyst")]
    public async Task<IActionResult> Receive(int id, [FromBody] ReceiveEmSampleRequest request)
    {
        var username = User.Identity?.Name ?? "Unknown";
        var result = await _mediator.Send(new ReceiveEmSampleCommand(id, username, request.AssignedAnalyst));
        if (!result.IsSuccess) return result.ErrorCode == "NOT_FOUND" ? NotFound() : BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return Ok(new { emSampleId = result.Value, status = "ReceivedByLab" });
    }

    // PATCH api/v1/em-samples/{id}/results
    [HttpPatch("{id:int}/results")]
    [Authorize(Roles = "Admin,QA,Analyst")]
    public async Task<IActionResult> EnterResults(int id, [FromBody] EnterResultsRequest request)
    {
        var username = User.Identity?.Name ?? "Unknown";
        var result = await _mediator.Send(new EnterEmResultsCommand(id, request.ResultStatus, username, request.ProcessLogRowId));
        if (!result.IsSuccess) return result.ErrorCode == "NOT_FOUND" ? NotFound() : BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return Ok(new { emSampleId = result.Value, status = "ResultsApproved", resultStatus = request.ResultStatus });
    }

    // PATCH api/v1/em-samples/{id}/investigation
    [HttpPatch("{id:int}/investigation")]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> UpdateInvestigation(int id, [FromBody] UpdateInvestigationRequest request)
    {
        var result = await _mediator.Send(new UpdateEmInvestigationCommand(id, request.InvestigationStatus, request.InvestigationNotes));
        if (!result.IsSuccess) return result.ErrorCode == "NOT_FOUND" ? NotFound() : BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return Ok(new { emSampleId = result.Value });
    }
}

public record ReceiveEmSampleRequest(string? AssignedAnalyst = null);
public record EnterResultsRequest(string ResultStatus, int? ProcessLogRowId = null);
public record UpdateInvestigationRequest(string InvestigationStatus, string? InvestigationNotes = null);
