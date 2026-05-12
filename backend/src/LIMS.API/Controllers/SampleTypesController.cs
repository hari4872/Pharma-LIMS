using LIMS.Application.Features.MasterData.SampleTypes;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LIMS.API.Controllers;

[ApiController]
[Route("api/v1/sample-types")]
[Authorize]
public class SampleTypesController : ControllerBase
{
    private readonly IMediator _mediator;
    public SampleTypesController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] bool includeInactive = false)
        => Ok(await _mediator.Send(new GetSampleTypesQuery(includeInactive)));

    [HttpPost]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> Create([FromBody] CreateSampleTypeRequest request)
    {
        var username = User.Identity?.Name ?? "Unknown";
        var result = await _mediator.Send(new CreateSampleTypeCommand(
            request.TypeName, request.TypeCode, request.Matrix, request.Stage,
            request.Description, username));
        if (!result.IsSuccess) return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return CreatedAtAction(nameof(GetAll), new { id = result.Value }, new { sampleTypeId = result.Value });
    }
}

public record CreateSampleTypeRequest(string TypeName, string TypeCode, string Matrix, string Stage, string? Description);
