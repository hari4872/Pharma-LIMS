using LIMS.Application.Features.MasterData.Instruments;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LIMS.API.Controllers;

[ApiController]
[Route("api/v1/instruments")]
[Authorize]
public class InstrumentsController : ControllerBase
{
    private readonly IMediator _mediator;
    public InstrumentsController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] int? labId, [FromQuery] string? status, [FromQuery] bool includeInactive = false)
        => Ok(await _mediator.Send(new GetInstrumentsQuery(labId, status, includeInactive)));

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Create([FromBody] CreateInstrumentRequest request)
    {
        var username = User.Identity?.Name ?? "Unknown";
        var result = await _mediator.Send(new CreateInstrumentCommand(
            request.LabId, request.InstrumentCode, request.InstrumentType,
            request.Model, request.SerialNumber, request.CalibrationDue, username));
        if (!result.IsSuccess) return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return CreatedAtAction(nameof(GetAll), new { id = result.Value }, new { instrumentId = result.Value });
    }
}

public record CreateInstrumentRequest(int LabId, string InstrumentCode, string InstrumentType, string? Model, string? SerialNumber, DateOnly CalibrationDue);
