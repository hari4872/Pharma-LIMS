using LIMS.Application.Features.SampleInventory;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LIMS.API.Controllers;

[ApiController]
[Route("api/v1/stability-pulls")]
[Authorize]
public class StabilityPullsController : LimsControllerBase
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
    [Authorize(Roles = "Admin,QA,LabManager")]
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
    [Authorize(Roles = "Admin,Analyst,LabManager")]
    public async Task<IActionResult> Execute(int id, [FromBody] ExecutePullRequest request)
    {
        if (!TryGetUserId(out var analystId)) return Unauthorized(new { error = "Invalid token claims." });
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

public record SchedulePullRequest(int SampleId, string TimePoint, DateOnly DueDate, decimal RequiredQty, string RequiredQtyUom);
public record ExecutePullRequest(decimal ActualQty, string? ShortReason, string Password, string Meaning);


