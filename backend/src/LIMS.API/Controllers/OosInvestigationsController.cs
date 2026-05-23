using LIMS.Application.Features.OosInvestigations;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LIMS.API.Controllers;

[ApiController]
[Route("api/v1/oos-investigations")]
[Authorize]
public class OosInvestigationsController : ControllerBase
{
    private readonly IMediator _mediator;
    public OosInvestigationsController(IMediator mediator) => _mediator = mediator;

    // GET api/v1/oos-investigations?status=Open&labId=1&executionId=5
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? status, [FromQuery] int? labId, [FromQuery] int? executionId)
        => Ok(await _mediator.Send(new GetOosInvestigationsQuery(status, labId, executionId)));

    // POST api/v1/oos-investigations/{id}/close — QA closes investigation §11.50 e-sig (FDA OOS Guidance)
    [HttpPost("{id}/close")]
    [Authorize(Roles = "Admin,QA,QCLead")]
    public async Task<IActionResult> Close(int id, [FromBody] CloseOosRequest request)
    {
        var userId = int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "0");
        var result = await _mediator.Send(new CloseOosInvestigationCommand(
            id, userId, request.RootCause, request.CapaRef, request.Password, request.Meaning, request.Reason));
        if (!result.IsSuccess)
        {
            if (result.ErrorCode == "ESIGN_AUTH_FAILED") return Unauthorized(new { error = result.ErrorCode, message = result.ErrorMessage });
            if (result.ErrorCode == "NOT_FOUND") return NotFound();
            return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        }
        return Ok(new { investigationId = result.Value, status = "Closed" });
    }

    // POST api/v1/oos-investigations/{id}/escalate-phase2 — Sprint 1: FDA OOS Phase 2 escalation
    [HttpPost("{id}/escalate-phase2")]
    [Authorize(Roles = "Admin,QA,QCLead")]
    public async Task<IActionResult> EscalateToPhase2(int id, [FromBody] EscalatePhase2Request request)
    {
        var userId = int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "0");
        var result = await _mediator.Send(new EscalateToPhase2Command(
            id, userId, request.EscalationReason, request.CapaRef,
            request.Password, request.Meaning, request.Reason));
        if (!result.IsSuccess)
        {
            if (result.ErrorCode == "ESIGN_AUTH_FAILED") return Unauthorized(new { error = result.ErrorCode, message = result.ErrorMessage });
            if (result.ErrorCode == "NOT_FOUND") return NotFound();
            return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        }
        return Ok(new { investigationId = result.Value, phase = "Phase2" });
    }
}

public record CloseOosRequest(string RootCause, string? CapaRef, string Password, string Meaning, string Reason);
public record EscalatePhase2Request(string EscalationReason, string? CapaRef, string Password, string Meaning, string Reason);
