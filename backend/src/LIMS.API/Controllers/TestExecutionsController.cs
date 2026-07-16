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
public class TestExecutionsController : LimsControllerBase
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

    // GET api/v1/test-executions?analystId=1&labId=2&status=Assigned � Work Queue
    [HttpGet]
    public async Task<IActionResult> GetWorkQueue(
        [FromQuery] int? analystId, [FromQuery] int? labId, [FromQuery] string? status)
        => Ok(await _mediator.Send(new GetWorkQueueQuery(analystId, labId, status)));

    // GET api/v1/test-executions/{id} � fetch single execution by ID (avoids stale client-side find)
    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        var execution = await _db.TestExecutions
            .Include(e => e.Sample).ThenInclude(s => s.Material)
            .Include(e => e.Analyst)
            .Include(e => e.Instrument)
            .Where(e => e.ExecutionId == id)
            .AsNoTracking()
            .FirstOrDefaultAsync(ct);

        if (execution is null) return NotFound(new { error = "NOT_FOUND", message = "Execution not found." });

        return Ok(new {
            execution.ExecutionId,
            execution.SampleId,
            SampleNumber   = execution.Sample?.SampleNumber ?? "�",
            MaterialName   = execution.Sample?.Material?.MaterialName ?? "�",
            MaterialId     = execution.Sample?.MaterialId ?? 0,
            LotNumber      = execution.Sample?.LotNumber ?? "�",
            AnalystName    = execution.Analyst?.FullName ?? "—",
            InstrumentCode = execution.Instrument?.InstrumentCode ?? "",
            Status         = execution.Status.ToString(),
            execution.StartedAt,
            DueDate        = execution.DueAt,
        });
    }

    // POST api/v1/test-executions � Lab Manager assigns sample to analyst (WAP FR-13)
    [HttpPost]
    [Authorize(Roles = "Admin,QA,LabManager")]
    public async Task<IActionResult> Assign([FromBody] AssignWorkQueueRequest request)
    {
        if (!TryGetUserId(out var assignedById)) return Unauthorized(new { error = "Invalid token claims." });
        var result = await _mediator.Send(new AssignWorkQueueItemCommand(
            request.SampleId, request.AnalystId, request.InstrumentId,
            assignedById, request.PriorityScore, request.ContainerId, request.SpecTemplateItemIds));
        if (!result.IsSuccess) return result.ErrorCode == "NOT_FOUND" ? NotFound(new { error = result.ErrorCode, message = result.ErrorMessage })
            : BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return CreatedAtAction(nameof(GetWorkQueue), new { id = result.Value }, new { executionId = result.Value });
    }

    // POST api/v1/test-executions/{id}/start � Analyst opens task / barcode scan (FR-22 started_at UTC)
    [HttpPost("{id}/start")]
    [Authorize(Roles = "Admin,Analyst,LabManager,QA")]
    public async Task<IActionResult> Start(int id)
    {
        if (!TryGetUserId(out var analystId)) return Unauthorized(new { error = "Invalid token claims." });
        var isAdmin = User.IsInRole("Admin") || User.IsInRole("QA");
        var result = await _mediator.Send(new StartTestExecutionCommand(id, analystId, isAdmin));
        if (!result.IsSuccess) return result.ErrorCode == "NOT_FOUND" ? NotFound() : BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return Ok(new { executionId = result.Value, status = "InProgress" });
    }

    // POST api/v1/test-executions/{id}/results � Step 4-5: submit raw values + OOS/OOT detection
    [HttpPost("{id}/results")]
    [Authorize(Roles = "Admin,Analyst,LabManager,QA")]
    public async Task<IActionResult> SubmitResults(int id, [FromBody] SubmitResultsRequest request)
    {
        if (!TryGetUserId(out var analystId)) return Unauthorized(new { error = "Invalid token claims." });
        var isAdmin = User.IsInRole("Admin") || User.IsInRole("QA");
        var result = await _mediator.Send(new SubmitTestResultsCommand(
            id, analystId, request.Entries, request.EntryMethod, isAdmin));
        if (!result.IsSuccess) return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return Ok(result.Value);
    }

    // POST api/v1/test-executions/ad-hoc - add an ad-hoc single-parameter test
    [HttpPost("ad-hoc")]
    [Authorize(Roles = "Admin,Analyst,QA,LabManager")]
    public async Task<IActionResult> AddAdHoc([FromBody] AdHocTestRequest request)
    {
        var username = User.Identity?.Name ?? "Unknown";
        var result = await _mediator.Send(new AddAdHocTestCommand(request.SampleId, request.ParameterId, request.Reason, username));
        if (!result.IsSuccess) return result.ErrorCode is "NOT_FOUND" or "PARAM_NOT_FOUND"
            ? NotFound(new { error = result.ErrorCode, message = result.ErrorMessage })
            : BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return Ok(result.Value);
    }

    // POST api/v1/test-executions/batch-results - batch result entry for multiple samples at once
    [HttpPost("batch-results")]
    [Authorize(Roles = "Admin,Analyst,LabManager,QA")]
    public async Task<IActionResult> BatchSubmit([FromBody] BatchSubmitRequest request)
    {
        if (!TryGetUserId(out var analystId)) return Unauthorized(new { error = "Invalid token claims." });
        var executions = request.Rows.Select(r => new BatchExecutionEntry(r.ExecutionId,
            r.Entries.Select(e => new ResultEntryDto(e.ParameterId, e.RawValue)).ToList())).ToList();
        var result = await _mediator.Send(new BatchSubmitResultsCommand(analystId, executions));
        if (!result.IsSuccess) return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return Ok(result.Value);
    }

    // GET api/v1/test-executions/{id}/parameters - execution-specific parameters via checkpoint links
    [HttpGet("{id}/parameters")]
    public async Task<IActionResult> GetParameters(int id)
        => Ok(await _mediator.Send(new GetExecutionParametersQuery(id)));

    // GET api/v1/test-executions/suggest-instrument � Phase D auto-suggest
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

    // POST api/v1/test-executions/{id}/sign-off � Step 7: §11.50 e-sig, logbook rows finalized
    [HttpPost("{id}/sign-off")]
    [Authorize(Roles = "Admin,Analyst,LabManager,QA")]
    public async Task<IActionResult> SignOff(int id, [FromBody] ApproveRequest request)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized(new { error = "Invalid token claims." });
        var isAdminSignOff = User.IsInRole("Admin") || User.IsInRole("QA");
        var result = await _mediator.Send(new SignOffTestExecutionCommand(id, userId, request.Password, request.Meaning, request.Reason, isAdminSignOff));
        if (!result.IsSuccess)
        {
            if (result.ErrorCode == "ESIGN_AUTH_FAILED") return Unauthorized(new { error = result.ErrorCode, message = result.ErrorMessage });
            return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        }
        return Ok(new { executionId = result.Value, status = "Signed" });
    }

    // �"��"� Sprint 6 � Intelligent Workflow Endpoints �"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"�

    // GET api/v1/test-executions/queue-intelligence?labId=1
    [HttpGet("queue-intelligence")]
    public async Task<IActionResult> QueueIntelligence([FromQuery] int? labId)
    {
        var effectiveLabId = _lab.IsCrossLab ? (labId ?? 0) : (_lab.LabId ?? 0);
        if (effectiveLabId == 0)
            effectiveLabId = await _db.Laboratories.Where(l => l.IsActive).Select(l => (int?)l.LabId).FirstOrDefaultAsync() ?? 0;
        // If user's labId doesn't exist in DB, fall back to first active lab
        if (effectiveLabId != 0)
        {
            var labExists = await _db.Laboratories.AnyAsync(l => l.LabId == effectiveLabId && l.IsActive);
            if (!labExists)
                effectiveLabId = await _db.Laboratories.Where(l => l.IsActive).Select(l => (int?)l.LabId).FirstOrDefaultAsync() ?? 0;
        }
        if (effectiveLabId == 0) return Ok(new { labId = 0, totalOpen = 0, overdue = 0, oosOpen = 0, analystLoads = Array.Empty<object>(), priorityBands = Array.Empty<object>(), avgTatHours = (double?)null });
        var result = await _intel.GetQueueIntelligenceAsync(effectiveLabId);
        return Ok(result);
    }

    // GET api/v1/test-executions/suggest-analyst?labId=1
    [HttpGet("suggest-analyst")]
    [Authorize(Roles = "Admin,QA,LabManager")]
    public async Task<IActionResult> SuggestAnalyst([FromQuery] int? labId)
    {
        var effectiveLabId = _lab.IsCrossLab ? (labId ?? 0) : (_lab.LabId ?? 0);
        if (effectiveLabId == 0)
            effectiveLabId = await _db.Laboratories.Where(l => l.IsActive).Select(l => (int?)l.LabId).FirstOrDefaultAsync() ?? 0;
        // If user's labId doesn't exist in DB, fall back to first active lab
        if (effectiveLabId != 0)
        {
            var labExists = await _db.Laboratories.AnyAsync(l => l.LabId == effectiveLabId && l.IsActive);
            if (!labExists)
                effectiveLabId = await _db.Laboratories.Where(l => l.IsActive).Select(l => (int?)l.LabId).FirstOrDefaultAsync() ?? 0;
        }
        if (effectiveLabId == 0) return Ok((object?)null);
        var suggestion = await _intel.SuggestAnalystAsync(effectiveLabId);
        return Ok(suggestion); // null means no suggestion — not an error
    }

    // GET api/v1/test-executions/{id}/priority-score
    [HttpGet("{id}/priority-score")]
    public async Task<IActionResult> GetPriorityScore(int id)
    {
        var score = await _intel.CalculatePriorityScoreAsync(id);
        return Ok(new { executionId = id, priorityScore = score });
    }

    // POST api/v1/test-executions/{id}/assign � per-test-method assignment (LabVantage parity)
    // Different from POST / (sample-level) � this targets a specific execution row directly.
    [HttpPost("{id}/assign")]
    [Authorize(Roles = "Admin,QA,LabManager")]
    public async Task<IActionResult> AssignTestMethod(int id, [FromBody] AssignTestMethodRequest request)
    {
        if (!TryGetUserId(out var assignedById)) return Unauthorized(new { error = "Invalid token claims." });
        var result = await _mediator.Send(new AssignTestMethodCommand(
            id, request.AnalystId, request.InstrumentId, assignedById, request.PriorityScore));
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.ErrorCode, message = result.ErrorMessage })
                : BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return Ok(new { executionId = result.Value, status = "Assigned" });
    }
}

public record AssignWorkQueueRequest(int SampleId, int AnalystId, int? InstrumentId = null, int? PriorityScore = null, int? ContainerId = null, int[]? SpecTemplateItemIds = null);
public record AssignTestMethodRequest(int AnalystId, int? InstrumentId = null, int? PriorityScore = null);
public record SubmitResultsRequest(List<ResultEntryDto> Entries, EntryMethod EntryMethod = EntryMethod.Manual);
public record BatchRowRequest(int ExecutionId, List<ResultEntryDto> Entries);
public record BatchSubmitRequest(List<BatchRowRequest> Rows);
public record AdHocTestRequest(int SampleId, int ParameterId, string Reason);



