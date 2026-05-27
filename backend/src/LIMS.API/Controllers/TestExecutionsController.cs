using LIMS.Application.Features.TestExecutions;
using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LIMS.API.Controllers;

[ApiController]
[Route("api/v1/test-executions")]
[Authorize]
public class TestExecutionsController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly ILimsDbContext _db;
    private readonly IWorkflowIntelligenceService _intel;
    private readonly ILabContext _lab;

    public TestExecutionsController(IMediator mediator, ILimsDbContext db,
        IWorkflowIntelligenceService intel, ILabContext lab)
    {
        _mediator = mediator;
        _db = db;
        _intel = intel;
        _lab = lab;
    }

    // GET api/v1/test-executions?analystId=1&labId=2&status=Assigned — Work Queue
    [HttpGet]
    public async Task<IActionResult> GetWorkQueue(
        [FromQuery] int? analystId, [FromQuery] int? labId, [FromQuery] string? status)
        => Ok(await _mediator.Send(new GetWorkQueueQuery(analystId, labId, status)));

    // POST api/v1/test-executions — Lab Manager assigns sample to analyst (WAP FR-13)
    [HttpPost]
    [Authorize(Roles = "Admin,QA,LabManager")]
    public async Task<IActionResult> Assign([FromBody] AssignWorkQueueRequest request)
    {
        var assignedById = int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "0");
        var result = await _mediator.Send(new AssignWorkQueueItemCommand(
            request.SampleId, request.AnalystId, request.InstrumentId,
            assignedById, request.PriorityScore));
        if (!result.IsSuccess) return result.ErrorCode == "NOT_FOUND" ? NotFound(new { error = result.ErrorCode, message = result.ErrorMessage })
            : BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return CreatedAtAction(nameof(GetWorkQueue), new { id = result.Value }, new { executionId = result.Value });
    }

    // POST api/v1/test-executions/{id}/start — Analyst opens task / barcode scan (FR-22 started_at UTC)
    [HttpPost("{id}/start")]
    [Authorize(Roles = "Analyst,QCLead")]
    public async Task<IActionResult> Start(int id)
    {
        var analystId = int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "0");
        var result = await _mediator.Send(new StartTestExecutionCommand(id, analystId));
        if (!result.IsSuccess) return result.ErrorCode == "NOT_FOUND" ? NotFound() : BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return Ok(new { executionId = result.Value, status = "InProgress" });
    }

    // POST api/v1/test-executions/{id}/results — Step 4-5: submit raw values + OOS/OOT detection
    [HttpPost("{id}/results")]
    [Authorize(Roles = "Analyst,QCLead")]
    public async Task<IActionResult> SubmitResults(int id, [FromBody] SubmitResultsRequest request)
    {
        var analystId = int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "0");
        var result = await _mediator.Send(new SubmitTestResultsCommand(
            id, analystId, request.Entries, request.EntryMethod));
        if (!result.IsSuccess) return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return Ok(result.Value);
    }

    // GET api/v1/test-executions/{id}/parameters — execution-specific parameters via checkpoint links
    [HttpGet("{id}/parameters")]
    public async Task<IActionResult> GetParameters(int id)
        => Ok(await _mediator.Send(new GetExecutionParametersQuery(id)));

    // GET api/v1/test-executions/suggest-instrument — Phase D auto-suggest
    // Returns ranked list of instruments capable of running a given TestMethod or Parameter.
    // Filters to: IsActive=true, InstrumentStatus=Available, Calibration not overdue.
    [HttpGet("suggest-instrument")]
    public async Task<IActionResult> SuggestInstrument(
        [FromQuery] int? testMethodId,
        [FromQuery] int? parameterId,
        [FromQuery] int? labId)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var q = _db.InstrumentTestMappings
            .Include(m => m.Instrument).ThenInclude(i => i.Lab)
            .Where(m => m.IsActive &&
                        m.Instrument.IsActive &&
                        m.Instrument.Status == LIMS.Domain.Enums.InstrumentStatus.Available &&
                        m.Instrument.CalibrationDue >= today);

        if (testMethodId.HasValue) q = q.Where(m => m.TestMethodId == testMethodId);
        if (parameterId.HasValue)  q = q.Where(m => m.ParameterId == parameterId);
        if (labId.HasValue)        q = q.Where(m => m.Instrument.LabId == labId);

        var suggestions = await q.OrderBy(m => m.Priority)
            .Select(m => new
            {
                m.InstrumentId,
                m.Instrument.InstrumentCode,
                m.Instrument.InstrumentType,
                m.Instrument.Model,
                m.Instrument.CalibrationDue,
                m.Instrument.Status,
                m.Priority,
                m.Notes,
                LabName = m.Instrument.Lab.LabName,
            })
            .Distinct()
            .ToListAsync();

        return Ok(suggestions);
    }

    // POST api/v1/test-executions/{id}/sign-off — Step 7: §11.50 e-sig, logbook rows finalized
    [HttpPost("{id}/sign-off")]
    [Authorize(Roles = "Analyst,QCLead")]
    public async Task<IActionResult> SignOff(int id, [FromBody] ApproveRequest request)
    {
        var userId = int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "0");
        var result = await _mediator.Send(new SignOffTestExecutionCommand(id, userId, request.Password, request.Meaning, request.Reason));
        if (!result.IsSuccess)
        {
            if (result.ErrorCode == "ESIGN_AUTH_FAILED") return Unauthorized(new { error = result.ErrorCode, message = result.ErrorMessage });
            return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        }
        return Ok(new { executionId = result.Value, status = "Signed" });
    }

    // ── Sprint 6 — Intelligent Workflow Endpoints ───────────────────────────

    // GET api/v1/test-executions/queue-intelligence?labId=1
    [HttpGet("queue-intelligence")]
    public async Task<IActionResult> QueueIntelligence([FromQuery] int? labId)
    {
        var effectiveLabId = _lab.IsCrossLab ? (labId ?? 0) : (_lab.LabId ?? 0);
        if (effectiveLabId == 0) return BadRequest(new { error = "labId required for queue intelligence" });
        var result = await _intel.GetQueueIntelligenceAsync(effectiveLabId);
        return Ok(result);
    }

    // GET api/v1/test-executions/suggest-analyst?labId=1
    [HttpGet("suggest-analyst")]
    [Authorize(Roles = "Admin,QA,LabManager")]
    public async Task<IActionResult> SuggestAnalyst([FromQuery] int? labId)
    {
        var effectiveLabId = _lab.IsCrossLab ? (labId ?? 0) : (_lab.LabId ?? 0);
        if (effectiveLabId == 0) return BadRequest(new { error = "labId required" });
        var suggestion = await _intel.SuggestAnalystAsync(effectiveLabId);
        if (suggestion is null) return NotFound(new { message = "No analysts available in this lab" });
        return Ok(suggestion);
    }

    // GET api/v1/test-executions/{id}/priority-score
    [HttpGet("{id}/priority-score")]
    public async Task<IActionResult> GetPriorityScore(int id)
    {
        var score = await _intel.CalculatePriorityScoreAsync(id);
        return Ok(new { executionId = id, priorityScore = score });
    }

    // POST api/v1/test-executions/{id}/assign — per-test-method assignment (LabVantage parity)
    // Different from POST / (sample-level) — this targets a specific execution row directly.
    [HttpPost("{id}/assign")]
    [Authorize(Roles = "Admin,QA,LabManager")]
    public async Task<IActionResult> AssignTestMethod(int id, [FromBody] AssignTestMethodRequest request)
    {
        var assignedById = int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "0");
        var result = await _mediator.Send(new AssignTestMethodCommand(
            id, request.AnalystId, request.InstrumentId, assignedById, request.PriorityScore));
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.ErrorCode, message = result.ErrorMessage })
                : BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return Ok(new { executionId = result.Value, status = "Assigned" });
    }
}

public record AssignWorkQueueRequest(int SampleId, int AnalystId, int InstrumentId, int? PriorityScore = null);
public record AssignTestMethodRequest(int AnalystId, int InstrumentId, int? PriorityScore = null);
public record SubmitResultsRequest(List<ResultEntryDto> Entries, EntryMethod EntryMethod = EntryMethod.Manual);
