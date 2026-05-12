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
        var result = await _mediator.Send(new CreateInstrumentCommand(request.LabId, request.InstrumentCode, request.InstrumentType, request.Model, request.SerialNumber, request.CalibrationDue, username));
        if (!result.IsSuccess) return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return CreatedAtAction(nameof(GetAll), new { id = result.Value }, new { instrumentId = result.Value });
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateInstrumentRequest request)
    {
        var username = User.Identity?.Name ?? "Unknown";
        var result = await _mediator.Send(new UpdateInstrumentCommand(id, request.InstrumentType, request.Model, request.SerialNumber, request.CalibrationDue, username));
        if (!result.IsSuccess) return result.ErrorCode == "NOT_FOUND" ? NotFound() : BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return Ok(new { instrumentId = result.Value });
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Deactivate(int id, [FromBody] DeactivateRequest request)
    {
        var username = User.Identity?.Name ?? "Unknown";
        var result = await _mediator.Send(new DeactivateInstrumentCommand(id, request.Reason, username));
        if (!result.IsSuccess) return result.ErrorCode == "NOT_FOUND" ? NotFound() : BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return Ok(new { instrumentId = result.Value, status = "Inactive" });
    }

    // POST api/v1/instruments/{id}/calibrations — create calibration record
    [HttpPost("{id}/calibrations")]
    [Authorize(Roles = "Admin,Analyst")]
    public async Task<IActionResult> CreateCalibration(int id, [FromBody] CreateCalibrationRequest request)
    {
        var username = User.Identity?.Name ?? "Unknown";
        var result = await _mediator.Send(new CreateCalibrationCommand(id, request.CalibrationDate, request.NextCalibrationDue, request.CertificateRef, username));
        if (!result.IsSuccess) return result.ErrorCode == "NOT_FOUND" ? NotFound() : BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return CreatedAtAction(nameof(GetAll), new { id = result.Value }, new { calibrationId = result.Value });
    }

    // POST api/v1/instruments/{id}/calibrations/{calId}/approve — QA §11.50 e-sig
    [HttpPost("{id}/calibrations/{calId:int}/approve")]
    [Authorize(Roles = "QA")]
    public async Task<IActionResult> ApproveCalibration(int id, int calId, [FromBody] ApproveRequest request)
    {
        var userId = int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "0");
        var result = await _mediator.Send(new ApproveCalibrationCommand(calId, userId, request.Password, request.Meaning, request.Reason));
        if (!result.IsSuccess)
        {
            if (result.ErrorCode == "ESIGN_AUTH_FAILED") return Unauthorized(new { error = result.ErrorCode, message = result.ErrorMessage });
            return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        }
        return Ok(new { calibrationId = result.Value, status = "Approved" });
    }
}

public record CreateInstrumentRequest(int LabId, string InstrumentCode, string InstrumentType, string? Model, string? SerialNumber, DateOnly CalibrationDue);
public record UpdateInstrumentRequest(string InstrumentType, string? Model, string? SerialNumber, DateOnly CalibrationDue);
public record CreateCalibrationRequest(DateOnly CalibrationDate, DateOnly NextCalibrationDue, string CertificateRef);
