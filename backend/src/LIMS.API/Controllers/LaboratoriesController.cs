using LIMS.Application.Features.MasterData.Laboratories;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LIMS.API.Controllers;

[ApiController]
[Route("api/v1/laboratories")]
[Authorize]
public class LaboratoriesController : ControllerBase
{
    private readonly IMediator _mediator;
    public LaboratoriesController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] bool includeInactive = false)
        => Ok(await _mediator.Send(new GetLaboratoriesQuery(includeInactive)));

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Create([FromBody] CreateLaboratoryRequest request)
    {
        var username = User.Identity?.Name ?? "Unknown";
        var result = await _mediator.Send(new CreateLaboratoryCommand(request.LabName, request.Location, request.LabType, username));
        if (!result.IsSuccess) return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return CreatedAtAction(nameof(GetAll), new { id = result.Value }, new { labId = result.Value });
    }
}

public record CreateLaboratoryRequest(string LabName, string Location, string LabType);
