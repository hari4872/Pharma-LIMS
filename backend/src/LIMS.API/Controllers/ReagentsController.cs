using LIMS.Application.Features.MasterData.Reagents;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LIMS.API.Controllers;

[ApiController]
[Route("api/v1/reagents")]
[Authorize]
public class ReagentsController : ControllerBase
{
    private readonly IMediator _mediator;
    public ReagentsController(IMediator mediator) => _mediator = mediator;

    // GET api/v1/reagents?includeInactive=false&methodId=1
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] bool includeInactive = false, [FromQuery] int? methodId = null)
        => Ok(await _mediator.Send(new GetReagentsQuery(includeInactive, methodId)));

    // POST api/v1/reagents — Admin/QA only
    [HttpPost]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> Create([FromBody] CreateReagentRequest request)
    {
        var username = User.Identity?.Name ?? "Unknown";
        var result   = await _mediator.Send(new CreateReagentCommand(
            request.ReagentCode, request.ReagentName, request.ReagentType,
            request.LotNumber, request.Potency, request.PotencyUom, request.Manufacturer,
            request.ExpiryDate, request.OpenedDate, request.LinkedMethodId,
            request.StorageCondition, username));
        if (!result.IsSuccess) return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return CreatedAtAction(nameof(GetAll), new { id = result.Value }, new { reagentId = result.Value });
    }

    // DELETE api/v1/reagents/{id} — soft deactivate, audit-logged
    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> Deactivate(int id, [FromBody] ReagentDeactivateRequest request)
    {
        var username = User.Identity?.Name ?? "Unknown";
        var result   = await _mediator.Send(new DeactivateReagentCommand(id, request.Reason, username));
        if (!result.IsSuccess) return result.ErrorCode == "NOT_FOUND" ? NotFound() : BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return Ok(new { reagentId = result.Value, status = "Inactive" });
    }
}

public record CreateReagentRequest(
    string ReagentCode, string ReagentName, string ReagentType,
    string LotNumber, decimal? Potency, string? PotencyUom, string? Manufacturer,
    DateOnly? ExpiryDate, DateOnly? OpenedDate, int? LinkedMethodId, string? StorageCondition);

public record ReagentDeactivateRequest(string Reason);
