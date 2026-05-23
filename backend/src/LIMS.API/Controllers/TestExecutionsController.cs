using LIMS.Application.Features.TestExecutions;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LIMS.API.Controllers;

[ApiController]
[Route("api/v1/test-executions")]
[Authorize]
public class TestExecutionsController : ControllerBase
{
    private readonly IMediator _mediator;
    public TestExecutionsController(IMediator mediator) => _mediator = mediator;

    // GET api/v1/test-executions?analystId=1&labId=2&status=Assigned — Work Queue
    [HttpGet]
    public async Task<IActionResult> GetWorkQueue(
        [FromQuery] int? analystId, [FromQuery] int? labId, [FromQuery] string? status)
        => Ok(await _mediator.Send(new GetWorkQueueQuery(analystId, labId, status)));

    // POST api/v1/test-executions — Lab Manager assigns sample to analyst (WAP FR-13)
    [HttpPost]
    [Authorize(Roles = "Admin,QA,LabManager")]
    public async Task<IActionResult> Assign([FromBody] AssignWorkQueueRequest request)
    {
        var assignedById = int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "0");
        var result = await _mediator.Send(new AssignWorkQueueItemCommand(
            request.SampleId, request.AnalystId, request.InstrumentId,
            assignedById, request.PriorityScore));
        if (!result.IsSuccess) return result.ErrorCode == "NOT_FOUND" ? NotFound(new { error = result.ErrorCode, message = result.ErrorMessage })
            : BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return CreatedAtAction(nameof(GetWorkQueue), new { id = result.Value }, new { executionId = result.Value });
    }

    // POST api/v1/test-executions/{id}/start — Analyst opens task / barcode scan (FR-22 started_at UTC)
    [HttpPost("{id}/start")]
    [Authorize(Roles = "Analyst,QCLead")]
    public async Task<IActionResult> Start(int id)
    {
        var analystId = int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "0");
        var result = await _mediator.Send(new StartTestExecutionCommand(id, analystId));
        if (!result.IsSuccess) return result.ErrorCode == "NOT_FOUND" ? NotFound() : BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return Ok(new { executionId = result.Value, status = "InProgress" });
    }

    // POST api/v1/test-executions/{id}/results — Step 4-5: submit raw values + OOS/OOT detection
    [HttpPost("{id}/results")]
    [Authorize(Roles = "Analyst,QCLead")]
    public async Task<IActionResult> SubmitResults(int id, [FromBody] SubmitResultsRequest request)
    {
        var analystId = int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "0");
        var result = await _mediator.Send(new SubmitTestResultsCommand(
            id, analystId, request.Entries, request.EntryMethod));
        if (!result.IsSuccess) return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return Ok(result.Value);
    }

    // GET api/v1/test-executions/{id}/parameters — execution-specific parameters via checkpoint links
    [HttpGet("{id}/parameters")]
    public async Task<IActionResult> GetParameters(int id)
        => Ok(await _mediator.Send(new GetExecutionParametersQuery(id)));

    // POST api/v1/test-executions/{id}/sign-off — Step 7: §11.50 e-sig, logbook rows finalized
    [HttpPost("{id}/sign-off")]
    [Authorize(Roles = "Analyst,QCLead")]
    public async Task<IActionResult> SignOff(int id, [FromBody] ApproveRequest request)
    {
        var userId = int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "0");
        var result = await _mediator.Send(new SignOffTestExecutionCommand(id, userId, request.Password, request.Meaning, request.Reason));
        if (!result.IsSuccess)
        {
            if (result.ErrorCode == "ESIGN_AUTH_FAILED") return Unauthorized(new { error = result.ErrorCode, message = result.ErrorMessage });
            return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        }
        return Ok(new { executionId = result.Value, status = "Signed" });
    }
}

public record AssignWorkQueueRequest(int SampleId, int AnalystId, int InstrumentId, int? PriorityScore = null);
public record SubmitResultsRequest(List<ResultEntryDto> Entries, EntryMethod EntryMethod = EntryMethod.Manual);
