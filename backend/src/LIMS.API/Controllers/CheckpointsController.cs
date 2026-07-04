using LIMS.Application.Features.Checkpoints;
using LIMS.Application.Interfaces;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LIMS.API.Controllers;

[ApiController]
[Route("api/v1/checkpoints")]
[Authorize]
public class CheckpointsController : LimsControllerBase
{
    private readonly IMediator _mediator;
    private readonly ILimsDbContext _db;
    public CheckpointsController(IMediator mediator, ILimsDbContext db)
    { _mediator = mediator; _db = db; }

    // GET api/v1/checkpoints?labId=1&triggerMode=TimeBased
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] int? labId, [FromQuery] string? triggerMode)
        => Ok(await _mediator.Send(new GetCheckpointsQuery(labId, triggerMode)));

    // GET api/v1/checkpoints/{id} -- single checkpoint with its parameters
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var all = await _mediator.Send(new GetCheckpointsQuery(null, null));
        var cp  = all.FirstOrDefault(c => c.CheckpointId == id);
        return cp is null ? NotFound() : Ok(cp);
    }

    // GET api/v1/checkpoints/{id}/triggers -- last 10 trigger log entries
    [HttpGet("{id:int}/triggers")]
    public async Task<IActionResult> GetTriggerHistory(int id, CancellationToken ct)
    {
        var logs = await _db.CheckpointTriggerLogs
            .Where(t => t.CheckpointId == id)
            .OrderByDescending(t => t.TriggeredAt)
            .Take(10)
            .Select(t => new {
                t.TriggerId, t.TriggerMode, t.TriggeredBy,
                t.TriggeredAt, t.DeliveryOrder, t.IsOfflineSync
            })
            .ToListAsync(ct);
        return Ok(logs);
    }

    // DELETE api/v1/checkpoints/{id} -- hard-delete (Admin/QA only; blocked if signed audit rows exist)
    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var cp = await _db.Checkpoints
            .Include(c => c.ProcessLogRows).ThenInclude(r => r.Readings)
            .Include(c => c.CheckpointParameters)
            .Include(c => c.Locations)
            .Include(c => c.TriggerLogs)
            .FirstOrDefaultAsync(c => c.CheckpointId == id, ct);
        if (cp is null) return NotFound();

        if (cp.ProcessLogRows.Any(r => r.SignatureId.HasValue))
            return BadRequest(new { error = "HAS_SIGNED_ROWS",
                message = "Cannot delete — this checkpoint has signed process log rows (21 CFR Part 11 audit trail)." });

        _db.ProcessLogReadings.RemoveRange(cp.ProcessLogRows.SelectMany(r => r.Readings));
        _db.ProcessLogRows.RemoveRange(cp.ProcessLogRows);
        _db.CheckpointTriggerLogs.RemoveRange(cp.TriggerLogs);
        _db.CheckpointParameters.RemoveRange(cp.CheckpointParameters);
        _db.CheckpointLocations.RemoveRange(cp.Locations);
        _db.SampleCheckpoints.RemoveRange(
            await _db.SampleCheckpoints.Where(sc => sc.CheckpointId == id).ToListAsync(ct));
        _db.Checkpoints.Remove(cp);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    // POST api/v1/checkpoints -- create checkpoint (Admin/QA, FR-01)
    [HttpPost]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> Create([FromBody] CreateCheckpointRequest request)
    {
        var username = User.Identity?.Name ?? "Unknown";
        var paramLimits = request.Parameters?
            .Select(p => new ParameterLimitsInput(p.ParameterId, p.AlertMin, p.AlertMax, p.ActionMin, p.ActionMax))
            .ToList();
        var result = await _mediator.Send(new CreateCheckpointCommand(
            request.CheckpointCode, request.LabId, request.TriggerMode,
            request.CheckpointType, request.TimeSlots, request.ShiftIntervalHrs,
            request.FormTemplateId, request.ParameterIds, username, paramLimits));
        if (!result.IsSuccess) return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return CreatedAtAction(nameof(GetAll), new { id = result.Value }, new { checkpointId = result.Value });
    }

    // GET api/v1/checkpoints/{id}/linked-samples -- samples for traceability link
    // Returns pre-linked samples (via SampleCheckpoint) first, then all active samples
    // so the analyst can always pick a sample even if registration didn't auto-link it.
    [HttpGet("{id}/linked-samples")]
    public async Task<IActionResult> GetLinkedSamples(int id, CancellationToken ct)
    {
        var linkedIds = await _db.SampleCheckpoints
            .Where(sc => sc.CheckpointId == id)
            .Select(sc => sc.SampleId)
            .ToListAsync(ct);

        var allSamples = await _db.Samples
            .Include(s => s.Material)
            .Where(s => s.Status == LIMS.Domain.Enums.SampleStatus.Registered
                     || s.Status == LIMS.Domain.Enums.SampleStatus.PendingTesting
                     || s.Status == LIMS.Domain.Enums.SampleStatus.InTesting)
            .OrderByDescending(s => s.CreatedAt)
            .Take(100)
            .Select(s => new {
                s.SampleId,
                s.SampleNumber,
                MaterialName = s.Material != null ? s.Material.MaterialName : "—",
                s.LotNumber,
                Status = s.Status.ToString(),
                s.CreatedAt,
                IsLinked = linkedIds.Contains(s.SampleId),
            })
            .ToListAsync(ct);

        // Pre-linked samples appear first, then the rest
        var ordered = allSamples
            .OrderByDescending(s => s.IsLinked)
            .ThenByDescending(s => s.CreatedAt)
            .ToList();

        return Ok(ordered);
    }

    // POST api/v1/checkpoints/{id}/trigger -- Mode 2: operator scan (FR-03), also Mode 4 manual DO entry
    [HttpPost("{id}/trigger")]
    [Authorize(Roles = "Admin,QA,Analyst")]
    public async Task<IActionResult> Trigger(int id, [FromBody] TriggerCheckpointRequest request)
    {
        var username = User.Identity?.Name ?? "Unknown";
        var result = await _mediator.Send(new TriggerCheckpointCommand(
            id, username, request.DeliveryOrder, request.IsOfflineSync, request.SampleId));
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
            id, userId, request.SlotLabel, request.Password, request.Meaning, request.Reason, readings, request.SampleId));
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

public record ParameterLimitsRequest(int ParameterId, decimal? AlertMin, decimal? AlertMax, decimal? ActionMin, decimal? ActionMax);
public record CreateCheckpointRequest(string CheckpointCode, int LabId, string TriggerMode,
    string CheckpointType, string? TimeSlots, int? ShiftIntervalHrs, int? FormTemplateId,
    List<int>? ParameterIds = null,
    List<ParameterLimitsRequest>? Parameters = null);
public record TriggerCheckpointRequest(string? DeliveryOrder = null, bool IsOfflineSync = false, int? SampleId = null);
public record ReadingRequest(int ParameterId, string Value);
public record SignProcessLogRequest(string Password, string Meaning, string Reason, List<ReadingRequest>? Readings = null);
public record ExecuteTimeBasedRequest(string SlotLabel, string Password, string Meaning, string Reason, List<ReadingRequest>? Readings = null, int? SampleId = null);
