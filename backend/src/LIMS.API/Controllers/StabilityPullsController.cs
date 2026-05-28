using LIMS.Application.Features.SampleInventory;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LIMS.API.Controllers;

[ApiController]
[Route("api/v1/stability-pulls")]
[Authorize]
public class StabilityPullsController : ControllerBase
{
    private readonly IMediator _mediator;
    public StabilityPullsController(IMediator mediator) { _mediator = mediator; }

    // GET api/v1/stability-pulls?sampleId=5&status=Pending
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] int? sampleId, [FromQuery] string? status)
        => Ok(await _mediator.Send(new GetStabilityPullsQuery(sampleId, status)));

    // POST api/v1/stability-pulls
    // FR-02: due dates from T0 + time-points from DB (Contract 2)
    [HttpPost]
    [Authorize(Roles = "Admin,QA,QCLead")]
    public async Task<IActionResult> Schedule([FromBody] SchedulePullRequest request)
    {
        var result = await _mediator.Send(new ScheduleStabilityPullCommand(
            request.SampleId, request.TimePoint, request.DueDate,
            request.RequiredQty, request.RequiredQtyUom));
        if (!result.IsSuccess) return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return CreatedAtAction(nameof(GetAll), new { sampleId = request.SampleId }, new { pullId = result.Value });
    }

    // POST api/v1/stability-pulls/{id}/execute
    // FR-05: pull §11.50 e-sig; FR-15: short pull deviation auto-logged
    [HttpPost("{id:int}/execute")]
    [Authorize(Roles = "Admin,Analyst,QCLead")]
    public async Task<IActionResult> Execute(int id, [FromBody] ExecutePullRequest request)
    {
        var analystId = int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "0");
        try
        {
            var result = await _mediator.Send(new ExecutePullCommand(
                id, request.ActualQty, request.ShortReason,
                analystId, request.Password, request.Meaning));
            if (!result.IsSuccess) return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
            return Ok(result.Value);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { error = "ESIGN_AUTH_FAILED", message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = "VALIDATION_FAILED", message = ex.Message });
        }
    }
}

// Retain Samples controller
[ApiController]
[Route("api/v1/retain-samples")]
[Authorize]
public class RetainSamplesController : ControllerBase
{
    private readonly IMediator _mediator;
    public RetainSamplesController(IMediator mediator) { _mediator = mediator; }

    // GET api/v1/retain-samples?sampleId=5&status=Active
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] int? sampleId, [FromQuery] string? status)
        => Ok(await _mediator.Send(new GetRetainSamplesQuery(sampleId, status)));

    // POST api/v1/retain-samples
    // FR-08: retention period from DB config (Contract 2)
    [HttpPost]
    [Authorize(Roles = "Admin,QA,QCLead,Analyst")]
    public async Task<IActionResult> Register([FromBody] RegisterRetainRequest request)
    {
        var username = User.Identity?.Name ?? "Unknown";
        var result = await _mediator.Send(new RegisterRetainSampleCommand(
            request.SampleId, request.LocationId,
            request.Quantity, request.QuantityUom,
            request.RetainedOn, username));
        if (!result.IsSuccess) return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return CreatedAtAction(nameof(GetAll), new { sampleId = request.SampleId }, new { retainId = result.Value });
    }

    // POST api/v1/retain-samples/{id}/destroy
    // QA §11.50 e-sig required; INSERT-only record (21 CFR 211.170)
    [HttpPost("{id:int}/destroy")]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> Destroy(int id, [FromBody] DestroyRetainRequest request)
    {
        var username = User.Identity?.Name ?? "Unknown";
        var result = await _mediator.Send(new DestroyRetainSampleCommand(
            id, username, request.Password, request.Meaning, request.Reason));
        if (!result.IsSuccess)
        {
            if (result.ErrorCode == "ESIGN_AUTH_FAILED") return Unauthorized(new { error = result.ErrorCode, message = result.ErrorMessage });
            return result.ErrorCode == "NOT_FOUND" ? NotFound() : BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        }
        return Ok(new { retainId = result.Value, status = "Destroyed" });
    }
}

public record SchedulePullRequest(int SampleId, string TimePoint, DateOnly DueDate, decimal RequiredQty, string RequiredQtyUom);
public record ExecutePullRequest(decimal ActualQty, string? ShortReason, string Password, string Meaning);
public record RegisterRetainRequest(int SampleId, int LocationId, decimal Quantity, string QuantityUom, DateOnly RetainedOn);
public record DestroyRetainRequest(string Password, string Meaning, string Reason);
