using LIMS.Application.Features.Checkpoints;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LIMS.API.Controllers;

[ApiController]
[Route("api/v1/checkpoints")]
[Authorize]
public class CheckpointsController : LimsControllerBase
{
    private readonly IMediator _mediator;
    public CheckpointsController(IMediator mediator) => _mediator = mediator;

    // GET api/v1/checkpoints?labId=1&triggerMode=TimeBased
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] int? labId, [FromQuery] string? triggerMode)
        => Ok(await _mediator.Send(new GetCheckpointsQuery(labId, triggerMode)));

    // POST api/v1/checkpoints -- create checkpoint (Admin/QA, FR-01)
    [HttpPost]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> Create([FromBody] CreateCheckpointRequest request)
    {
        var username = User.Identity?.Name ?? "Unknown";
        var result = await _mediator.Send(new CreateCheckpointCommand(
            request.CheckpointCode, request.LabId, request.TriggerMode,
            request.CheckpointType, request.TimeSlots, request.ShiftIntervalHrs,
            request.FormTemplateId, request.ParameterIds, username));
        if (!result.IsSuccess) return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return CreatedAtAction(nameof(GetAll), new { id = result.Value }, new { checkpointId = result.Value });
    }

    // POST api/v1/checkpoints/{id}/trigger -- Mode 2: operator scan (FR-03), also Mode 4 manual DO entry
    [HttpPost("{id}/trigger")]
    [Authorize(Roles = "Admin,QA,Analyst")]
    public async Task<IActionResult> Trigger(int id, [FromBody] TriggerCheckpointRequest request)
    {
        var username = User.Identity?.Name ?? "Unknown";
        var result = await _mediator.Send(new TriggerCheckpointCommand(
            id, username, request.DeliveryOrder, request.IsOfflineSync));
        if (!result.IsSuccess) return result.ErrorCode == "NOT_FOUND" ? NotFound() : BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return Ok(new { checkpointId = result.Value, status = "Triggered" });
    }

    // POST api/v1/checkpoints/{id}/execute -- Mode 1: analyst records readings + e-signs a time-based slot
    [HttpPost("{id}/execute")]
    [Authorize(Roles = "Admin,QA,Analyst")]
    public async Task<IActionResult> ExecuteTimeBased(int id, [FromBody] ExecuteTimeBasedRequest request)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized(new { error = "Invalid token claims." });
        var readings = request.Readings?.Select(r => new ParameterReadingInput(r.ParameterId, r.Value)).ToList();
        var result = await _mediator.Send(new ExecuteTimeBasedCheckpointCommand(
            id, userId, request.SlotLabel, request.Password, request.Meaning, request.Reason, readings));
        if (!result.IsSuccess)
        {
            if (result.ErrorCode == "ESIGN_AUTH_FAILED")
                return Unauthorized(new { error = result.ErrorCode, message = result.ErrorMessage });
            return result.ErrorCode == "NOT_FOUND" ? NotFound()
                : BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        }
        return Ok(new { rowId = result.Value, status = "Executed" });
    }

    // GET api/v1/checkpoints/process-log?date=2026-05-28 -- ALL checkpoints, for Digital Logbook tab
    [HttpGet("process-log")]
    public async Task<IActionResult> GetAllProcessLog([FromQuery] DateOnly? date)
        => Ok(await _mediator.Send(new GetAllProcessLogQuery(date)));

    // GET api/v1/checkpoints/{id}/process-log?date=2026-05-12 -- Mode 3 rows (per checkpoint)
    [HttpGet("{id}/process-log")]
    public async Task<IActionResult> GetProcessLog(int id, [FromQuery] DateOnly? date)
        => Ok(await _mediator.Send(new GetProcessLogQuery(id, date)));

    // POST api/v1/checkpoints/{id}/process-log/{rowId}/sign -- Mode 3: row e-sig (FR-12)
    [HttpPost("{id}/process-log/{rowId:int}/sign")]
    [Authorize(Roles = "Admin,QA,Analyst")]
    public async Task<IActionResult> SignProcessLogRow(int id, int rowId, [FromBody] SignProcessLogRequest request)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized(new { error = "Invalid token claims." });
        var readings = request.Readings?.Select(r => new ParameterReadingInput(r.ParameterId, r.Value)).ToList();
        var result = await _mediator.Send(new SignProcessLogRowCommand(rowId, userId, request.Password, request.Meaning, request.Reason, readings));
        if (!result.IsSuccess)
        {
            if (result.ErrorCode == "ESIGN_AUTH_FAILED") return Unauthorized(new { error = result.ErrorCode, message = result.ErrorMessage });
            return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        }
        return Ok(new { rowId = result.Value, status = "Locked" });
    }
}

public record CreateCheckpointRequest(string CheckpointCode, int LabId, string TriggerMode,
    string CheckpointType, string? TimeSlots, int? ShiftIntervalHrs, int? FormTemplateId,
    List<int>? ParameterIds = null);
public record TriggerCheckpointRequest(string? DeliveryOrder = null, bool IsOfflineSync = false);
public record ReadingRequest(int ParameterId, string Value);
public record SignProcessLogRequest(string Password, string Meaning, string Reason, List<ReadingRequest>? Readings = null);
public record ExecuteTimeBasedRequest(string SlotLabel, string Password, string Meaning, string Reason, List<ReadingRequest>? Readings = null);
