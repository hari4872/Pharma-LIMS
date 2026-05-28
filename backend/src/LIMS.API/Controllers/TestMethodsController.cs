using LIMS.Application.Features.MasterData.TestMethods;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LIMS.API.Controllers;

[ApiController]
[Route("api/v1/test-methods")]
[Authorize]
public class TestMethodsController : ControllerBase
{
    private readonly IMediator _mediator;
    public TestMethodsController(IMediator mediator) => _mediator = mediator;

    // GET api/v1/test-methods?statusFilter=Approved
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? statusFilter, [FromQuery] bool includeInactive = false)
        => Ok(await _mediator.Send(new GetTestMethodsQuery(statusFilter, includeInactive)));

    [HttpPost]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> Create([FromBody] CreateTestMethodRequest request)
    {
        var username = User.Identity?.Name ?? "Unknown";
        var result = await _mediator.Send(new CreateTestMethodCommand(request.MethodCode, request.MethodName, request.SopReference, request.MethodType, username));
        if (!result.IsSuccess) return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return CreatedAtAction(nameof(GetAll), new { id = result.Value }, new { methodId = result.Value });
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateTestMethodRequest request)
    {
        var username = User.Identity?.Name ?? "Unknown";
        var result = await _mediator.Send(new UpdateTestMethodCommand(id, request.MethodName, request.SopReference, request.MethodType, username));
        if (!result.IsSuccess) return result.ErrorCode == "NOT_FOUND" ? NotFound() : BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return Ok(new { methodId = result.Value, status = "Draft" });
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> Deactivate(int id, [FromBody] DeactivateRequest request)
    {
        var username = User.Identity?.Name ?? "Unknown";
        var result = await _mediator.Send(new DeactivateTestMethodCommand(id, request.Reason, username));
        if (!result.IsSuccess) return result.ErrorCode == "NOT_FOUND" ? NotFound() : BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return Ok(new { methodId = result.Value, status = "Retired" });
    }

    // POST api/v1/test-methods/{id}/approve — §11.50 QA e-sig
    [HttpPost("{id}/approve")]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> Approve(int id, [FromBody] ApproveRequest request)
    {
        var userId = int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "0");
        var result = await _mediator.Send(new ApproveTestMethodCommand(id, userId, request.Password, request.Meaning, request.Reason));
        if (!result.IsSuccess)
        {
            if (result.ErrorCode == "ESIGN_AUTH_FAILED") return Unauthorized(new { error = result.ErrorCode, message = result.ErrorMessage });
            return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        }
        return Ok(new { methodId = result.Value, status = "Approved" });
    }
}

public record CreateTestMethodRequest(string MethodCode, string MethodName, string? SopReference, string? MethodType);
public record UpdateTestMethodRequest(string MethodName, string? SopReference, string? MethodType);
public record ApproveRequest(string Password, string Meaning, string Reason);
