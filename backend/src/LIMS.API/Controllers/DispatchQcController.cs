using LIMS.Application.Features.DispatchQc;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LIMS.API.Controllers;

[ApiController]
[Route("api/v1/dispatch-qc")]
[Authorize]
public class DispatchQcController : ControllerBase
{
    private readonly IMediator _mediator;
    public DispatchQcController(IMediator mediator) => _mediator = mediator;

    // GET api/v1/dispatch-qc?status=&doId=
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? status, [FromQuery] int? doId)
    {
        var result = await _mediator.Send(new GetDispatchQcTasksQuery(status, doId));
        return Ok(result);
    }

    // POST api/v1/dispatch-qc/{taskId}/approve — QA §11.50 e-sig, sets CLEARED
    [HttpPost("{taskId}/approve")]
    [Authorize(Roles = "QA,Admin")]
    public async Task<IActionResult> Approve(int taskId, [FromBody] DispatchQcApproveRequest request)
    {
        var qaUserId = int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "0");
        var result = await _mediator.Send(new ApproveDispatchQcCommand(
            taskId, qaUserId, request.Password, request.Meaning, request.Reason));
        if (!result.IsSuccess)
        {
            if (result.ErrorCode == "ESIGN_AUTH_FAILED") return Unauthorized(new { error = result.ErrorCode, message = result.ErrorMessage });
            return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        }
        return Ok(new { taskId = result.Value, status = "QAApproved", doStatus = "CLEARED" });
    }
}

public record DispatchQcApproveRequest(string Password, string Meaning, string Reason);
