using LIMS.API.Attributes;
using LIMS.Application.Features.DispatchQc;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LIMS.API.Controllers;

[ApiController]
[Route("api/v1/dispatch-qc")]
[Authorize]
public class DispatchQcController : LimsControllerBase
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

    // POST api/v1/dispatch-qc/delivery-orders/{doId}/block — QA hold, sets BLOCKED
    [HttpPost("delivery-orders/{doId}/block")]
    [Authorize(Roles = "QA,Admin,QCLead,LabManager")]
    [RequirePermission("dispatchQc")]
    public async Task<IActionResult> Block(int doId, [FromBody] BlockRequest request)
    {
        var username = User.Identity?.Name ?? "Unknown";
        var result = await _mediator.Send(new BlockDispatchQcCommand(doId, request.Reason, username));
        if (!result.IsSuccess) return result.ErrorCode == "NOT_FOUND" ? NotFound() : BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return Ok(new { doId = result.Value, status = "Blocked" });
    }

    // POST api/v1/dispatch-qc/delivery-orders/{doId}/unblock — re-enter QC flow after CAPA
    [HttpPost("delivery-orders/{doId}/unblock")]
    [Authorize(Roles = "QA,Admin,QCLead,LabManager")]
    [RequirePermission("dispatchQc")]
    public async Task<IActionResult> Unblock(int doId, [FromBody] BlockRequest request)
    {
        var username = User.Identity?.Name ?? "Unknown";
        var result = await _mediator.Send(new UnblockDispatchQcCommand(doId, request.Reason, username));
        if (!result.IsSuccess) return result.ErrorCode == "NOT_FOUND" ? NotFound() : BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return Ok(new { doId = result.Value, status = "InDispatchQC" });
    }

    // POST api/v1/dispatch-qc/{taskId}/approve — QA Â§11.50 e-sig, sets CLEARED
    [HttpPost("{taskId}/approve")]
    [Authorize(Roles = "QA,Admin,QCLead,LabManager")]
    [RequirePermission("dispatchQc")]
    public async Task<IActionResult> Approve(int taskId, [FromBody] DispatchQcApproveRequest request)
    {
        if (!TryGetUserId(out var qaUserId)) return Unauthorized(new { error = "Invalid token claims." });
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
public record BlockRequest(string Reason);

