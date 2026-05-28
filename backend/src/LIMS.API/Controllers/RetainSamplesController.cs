using LIMS.Application.Features.SampleInventory;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LIMS.API.Controllers;

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

public record RegisterRetainRequest(int SampleId, int LocationId, decimal Quantity, string QuantityUom, DateOnly RetainedOn);
public record DestroyRetainRequest(string Password, string Meaning, string Reason);
