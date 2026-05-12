using LIMS.Application.Features.MasterData.LabConfigs;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LIMS.API.Controllers;

[ApiController]
[Route("api/v1/lab-config")]
[Authorize]
public class LabConfigController : ControllerBase
{
    private readonly IMediator _mediator;
    public LabConfigController(IMediator mediator) => _mediator = mediator;

    // GET api/v1/lab-config?labId=1
    [HttpGet]
    public async Task<IActionResult> GetByLab([FromQuery] int labId)
        => Ok(await _mediator.Send(new GetLabConfigQuery(labId)));

    // PUT api/v1/lab-config — upsert a single key/value for a lab
    [HttpPut]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Upsert([FromBody] UpsertLabConfigRequest request)
    {
        var username = User.Identity?.Name ?? "Unknown";
        var result = await _mediator.Send(new UpsertLabConfigCommand(request.LabId, request.ConfigKey, request.ConfigValue, username));
        if (!result.IsSuccess) return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return Ok(new { configId = result.Value });
    }
}

public record UpsertLabConfigRequest(int LabId, string ConfigKey, string ConfigValue);
