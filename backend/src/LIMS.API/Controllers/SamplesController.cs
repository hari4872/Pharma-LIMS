using LIMS.API.Attributes;
using LIMS.Application.Features.Samples;
using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LIMS.API.Controllers;

[ApiController]
[Route("api/v1/samples")]
[Authorize]
public class SamplesController : LimsControllerBase
{
    private readonly IMediator _mediator;
    private readonly ILimsDbContext _db;
    private readonly ISpecificationEngineService _specEngine;
    private readonly IMasterDataAuditService _audit;
    public SamplesController(IMediator mediator, ILimsDbContext db, ISpecificationEngineService specEngine, IMasterDataAuditService audit)
    { _mediator = mediator; _db = db; _specEngine = specEngine; _audit = audit; }

    // GET api/v1/samples?labId=1&status=PendingTesting
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] int? labId, [FromQuery] string? status, [FromQuery] int? analystId)
        => Ok(await _mediator.Send(new GetSamplesQuery(labId, status, analystId)));

    // POST api/v1/samples � FR-01: unified entry for both manual and checkpoint auto-trigger
    [HttpPost]
    [Authorize(Roles = "Admin,Analyst,LabManager")]
    [RequirePermission("sampleRegistration")]
    public async Task<IActionResult> Register([FromBody] RegisterSampleRequest request)
    {
        var username = User.Identity?.Name ?? "Unknown";
        if (!TryGetUserId(out var userId)) return Unauthorized(new { error = "Invalid token claims." });
        var scheduleItems = request.ScheduleItems?
            .Select(s => new ScheduleItemDto(s.InstrumentId, s.StartTime, s.EndTime, s.TestName))
            .ToList();
        var result   = await _mediator.Send(new RegisterSampleCommand(
            request.LabId, request.MaterialId, request.LotNumber,
            request.MfgDate, request.ExpDate, request.SampleTypeId,
            userId, username,
            // Phase A fields
            request.ReceivedTemp, request.SampleCondition, request.IsRush,
            request.ExternalBatchId, request.SampleLabel, request.TankSourceId,
            request.OverrideSpecTemplateId, request.CheckpointIds,
            scheduleItems));

        if (!result.IsSuccess) return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });

        var v = result.Value!;
        return CreatedAtAction(nameof(GetAll), new { id = v.SampleId }, new
        {
            v.SampleId, v.SampleNumber,
            v.SpecOutcome, v.SpecMessage, v.TestsAutoCreated
        });
    }

    // POST api/v1/samples/{id}/sign-srf � Step 7: SRF §11.50 e-sig → PendingTesting (FR-09)
    [HttpPost("{id}/sign-srf")]
    [Authorize(Roles = "Admin,Analyst,QA,LabManager")]
    public async Task<IActionResult> SignSRF(int id, [FromBody] ApproveRequest request)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized(new { error = "Invalid token claims." });
        var result = await _mediator.Send(new SignSRFCommand(id, userId, request.Password, request.Meaning, request.Reason));
        if (!result.IsSuccess)
        {
            if (result.ErrorCode == "ESIGN_AUTH_FAILED") return Unauthorized(new { error = result.ErrorCode, message = result.ErrorMessage });
            return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        }
        return Ok(new { sampleId = result.Value, status = "PendingTesting" });
    }

    // POST api/v1/samples/{id}/barcode-reprint � FR-18: audit-logged reprint with mandatory reason
    [HttpPost("{id}/barcode-reprint")]
    [Authorize(Roles = "Admin,Analyst,LabManager,QA")]
    public async Task<IActionResult> ReprintBarcode(int id, [FromBody] ReprintBarcodeRequest request)
    {
        var username = User.Identity?.Name ?? "Unknown";
        var result = await _mediator.Send(new ReprintBarcodeCommand(id, request.Reason, username));
        if (!result.IsSuccess) return result.ErrorCode == "NOT_FOUND" ? NotFound() : BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return Ok(new { sampleId = result.Value, status = "Reprinted" });
    }

    // GET api/v1/samples/{id}/spec-assignment
    [HttpGet("{id}/spec-assignment")]
    public async Task<IActionResult> GetSpecAssignment(int id, CancellationToken ct)
    {
        var sample = await _db.Samples
            .Include(s => s.SpecTemplate).ThenInclude(t => t!.Items)
            .FirstOrDefaultAsync(s => s.SampleId == id, ct);
        if (sample is null) return NotFound();

        // Available candidates via spec engine
        var sampleType = await _db.SampleTypes.FindAsync([sample.SampleTypeId], ct);
        SpecMatchResult? match = null;
        if (sampleType is not null)
            match = await _specEngine.MatchAsync(sample.MaterialId, sample.SampleTypeId, sampleType.Stage, ct);

        return Ok(new {
            sampleId          = sample.SampleId,
            sampleNumber      = sample.SampleNumber,
            specTemplateId    = sample.SpecTemplateId,
            specTemplateName  = sample.SpecTemplate?.TemplateName,
            specAssignedBy    = sample.SpecAssignedBy,
            specAssignedAt    = sample.SpecAssignedAt,
            specAssignmentReason = sample.SpecAssignmentReason?.ToString(),
            testsCreated      = sample.SpecTemplateId.HasValue
                ? await _db.TestExecutions.CountAsync(e => e.SampleId == id, ct) : 0,
            candidates        = match?.Candidates ?? new List<SpecTemplateSummary>(),
            matchOutcome      = match?.Outcome.ToString() ?? "Unknown",
        });
    }

    // GET api/v1/samples/{id} � full sample detail with related executions (single query)
    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        var sample = await _db.Samples
            .Where(s => s.SampleId == id)
            .Include(s => s.Material)
            .Include(s => s.SampleTypeNav)
            .Include(s => s.SpecTemplate)
            .Include(s => s.FormTemplate)
            .Include(s => s.TestExecutions).ThenInclude(e => e.Analyst)
            .Include(s => s.TestExecutions).ThenInclude(e => e.Instrument)
            .Include(s => s.TestExecutions).ThenInclude(e => e.SpecTemplateItem!).ThenInclude(i => i.TestMethod)
            .Include(s => s.TestExecutions).ThenInclude(e => e.SpecTemplateItem!).ThenInclude(i => i.Parameter)
            .AsNoTracking()
            .AsSplitQuery()
            .FirstOrDefaultAsync(ct);

        if (sample is null) return NotFound();

        return Ok(new {
            sample.SampleId, sample.SampleNumber, sample.LotNumber,
            sample.MaterialId,
            MaterialName     = sample.Material != null ? sample.Material.MaterialName : "Unknown",
            SampleTypeName   = sample.SampleTypeNav != null ? sample.SampleTypeNav.TypeName : "Unknown",
            Status           = sample.Status.ToString(),
            sample.IsRush, sample.BarcodePrinted,
            sample.CreatedAt, sample.DueDate,
            // Normalize legacy integer-stored values ("0","1","2") to readable names
            SampleCondition = sample.SampleCondition switch {
                "0" => "OK",
                "1" => "Damaged",
                "2" => "Compromised",
                _   => sample.SampleCondition ?? "OK"
            },
            sample.ExternalBatchId,
            SpecTemplateName = sample.SpecTemplate != null ? sample.SpecTemplate.TemplateName : null,
            sample.SpecTemplateId,
            sample.FormTemplateId,
            FormTemplateName = sample.FormTemplate != null ? sample.FormTemplate.FormName : null,
            TestExecutions = sample.TestExecutions
                .OrderBy(e => e.SpecTemplateItem != null ? e.SpecTemplateItem.SortOrder : e.PriorityScore ?? 999)
                .Select(e => new {
                    e.ExecutionId,
                    Status         = e.Status.ToString(),
                    AnalystName    = e.Analyst != null ? e.Analyst.FullName : "�",
                    InstrumentCode = e.Instrument != null ? e.Instrument.InstrumentCode : "�",
                    e.PriorityScore, e.StartedAt, e.CompletedAt, DueDate = e.DueAt,
                    TestLabel      = e.SpecTemplateItem != null && e.SpecTemplateItem.TestMethod != null
                        ? e.SpecTemplateItem.TestMethod.MethodName
                        : e.SpecTemplateItem != null && e.SpecTemplateItem.Parameter != null
                            ? e.SpecTemplateItem.Parameter.ParameterName
                            : null
                }).ToList()
        });
    }

    // POST api/v1/samples/batch-register - register multiple samples at once
    [HttpPost("batch-register")]
    [Authorize(Roles = "Admin,Analyst,LabManager")]
    [RequirePermission("sampleRegistration")]
    public async Task<IActionResult> BatchRegister([FromBody] BatchRegisterRequest request)
    {
        var username = User.Identity?.Name ?? "Unknown";
        if (!TryGetUserId(out var userId)) return Unauthorized(new { error = "Invalid token claims." });
        var entries = request.Entries.Select(e => new BatchSampleEntry(
            e.MaterialId, e.LotNumber, e.MfgDate, e.ExpDate, e.SampleTypeId,
            e.ReceivedTemp, e.SampleCondition, e.IsRush, e.ExternalBatchId)).ToList();
        var result = await _mediator.Send(new BatchRegisterSamplesCommand(request.LabId, userId, username, entries));
        if (!result.IsSuccess) return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return Ok(result.Value);
    }

    // GET api/v1/samples/{id}/tested-parameters -- parameters tested on original sample with pass/fail
    [HttpGet("{id}/tested-parameters")]
    public async Task<IActionResult> GetTestedParameters(int id, CancellationToken ct)
    {
        var entries = await _db.DigitalLogbookEntries
            .Where(e => e.SampleId == id)
            .Include(e => e.Parameter)
            .GroupBy(e => e.ParameterId)
            .Select(g => new {
                parameterId   = g.Key,
                parameterName = g.First().Parameter != null ? g.First().Parameter.ParameterName : "Unknown",
                uom           = g.First().Parameter != null ? g.First().Parameter.Uom : "",
                isOos         = g.Any(e => e.IsOos),
                isOot         = g.Any(e => e.IsOot),
                lastValue     = g.OrderByDescending(e => e.CreatedAt).First().RawValue,
            })
            .ToListAsync(ct);
        return Ok(entries);
    }

    // POST api/v1/samples/{id}/duplicate
    [HttpPost("{id}/duplicate")]
    [Authorize(Roles = "Admin,Analyst,QA,LabManager")]
    [RequirePermission("sampleRegistration")]
    public async Task<IActionResult> Duplicate(int id)
    {
        var username = User.Identity?.Name ?? "Unknown";
        var result = await _mediator.Send(new DuplicateSampleCommand(id, username));
        if (!result.IsSuccess) return result.ErrorCode == "NOT_FOUND" ? NotFound() : BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        var v = result.Value!;
        return Ok(new { v.SampleId, v.SampleNumber, v.SpecOutcome, v.SpecMessage });
    }

    // POST api/v1/samples/{id}/retest
    [HttpPost("{id}/retest")]
    [Authorize(Roles = "Admin,Analyst,QA,LabManager")]
    [RequirePermission("sampleRegistration")]
    public async Task<IActionResult> Retest(int id, [FromBody] RetestRequest request)
    {
        var username = User.Identity?.Name ?? "Unknown";
        var result = await _mediator.Send(new RetestSampleCommand(id, request.RetestReason, username, request.ParameterIds));
        if (!result.IsSuccess) return result.ErrorCode == "NOT_FOUND" ? NotFound() : BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        var v = result.Value!;
        return Ok(new { v.SampleId, v.SampleNumber, v.SpecOutcome, v.SpecMessage });
    }

    // POST api/v1/samples/{id}/apply-spec
    [HttpPost("{id}/apply-spec")]
    [Authorize(Roles = "Admin,QA,Analyst,LabManager")]
    public async Task<IActionResult> ApplySpec(int id, [FromBody] ApplySpecRequest req, CancellationToken ct)
    {
        var sample = await _db.Samples.FindAsync([id], ct);
        if (sample is null) return NotFound();
        var userName = User.Identity?.Name ?? "unknown";
        var execIds = await _specEngine.ApplyTemplateAsync(
            id, req.SpecTemplateId, userName, SpecAssignmentReason.ManualOverride,
            DateTimeOffset.UtcNow, ct);
        return Ok(new { testsCreated = execIds.Count, specTemplateId = req.SpecTemplateId });
    }

    // POST api/v1/samples/{id}/assign-form-template � manually assign a form template when auto-select failed
    [HttpPost("{id}/assign-form-template")]
    [Authorize(Roles = "Admin,QA,LabManager")]
    public async Task<IActionResult> AssignFormTemplate(int id, [FromBody] AssignFormTemplateRequest req, CancellationToken ct)
    {
        var sample = await _db.Samples.FindAsync([id], ct);
        if (sample is null) return NotFound(new { error = "Sample not found." });

        var template = await _db.FormTemplates.FindAsync([req.FormTemplateId], ct);
        if (template is null) return NotFound(new { error = "Form template not found." });

        var oldFormTemplateId = sample.FormTemplateId;
        sample.FormTemplateId = req.FormTemplateId;
        await _db.SaveChangesAsync(ct);

        // Audit log � 21 CFR �11.10(e): record who changed form template, old value, new value
        var userName = User.Identity?.Name ?? "Unknown";
        await _audit.LogAsync("Sample", id, "FormTemplateChanged",
            oldFormTemplateId.HasValue ? new { FormTemplateId = oldFormTemplateId.Value } : null,
            new { FormTemplateId = req.FormTemplateId, FormTemplateName = template.FormName, AssignmentMethod = "Manual" },
            userName);

        return Ok(new { formTemplateId = req.FormTemplateId, formTemplateName = template.FormName });
    }

    // GET api/v1/samples/{id}/form-entries — audit trail of past form submissions
    [HttpGet("{id}/form-entries")]
    public async Task<IActionResult> GetFormEntries(int id, CancellationToken ct)
    {
        var rows = await _db.SampleFormEntries
            .Where(e => e.SampleId == id)
            .OrderByDescending(e => e.SubmittedAt)
            .ToListAsync(ct);

        var result = rows.Select(e => new
        {
            entryId     = e.SampleFormEntryId,
            submittedBy = e.SubmittedBy,
            submittedAt = e.SubmittedAt,
            fieldValues = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, string>>(e.FieldValuesJson)
        });
        return Ok(result);
    }

    // POST api/v1/samples/{id}/form-entries — record that the monitoring form has been filled (INSERT-only, 21 CFR §11)
    [HttpPost("{id}/form-entries")]
    [Authorize(Roles = "Admin,QA,LabManager,Analyst")]
    public async Task<IActionResult> SubmitFormEntry(int id, [FromBody] SubmitFormEntryRequest req, CancellationToken ct)
    {
        var sample = await _db.Samples.FindAsync([id], ct);
        if (sample is null) return NotFound(new { error = "Sample not found." });

        var template = await _db.FormTemplates.FindAsync([req.FormTemplateId], ct);
        if (template is null) return NotFound(new { error = "Form template not found." });

        var userName = User.Identity?.Name ?? "Unknown";
        var entry = new SampleFormEntry
        {
            SampleId        = id,
            FormTemplateId  = req.FormTemplateId,
            FieldValuesJson = System.Text.Json.JsonSerializer.Serialize(req.FieldValues),
            SubmittedBy     = userName,
            SubmittedAt     = DateTimeOffset.UtcNow,
        };
        _db.SampleFormEntries.Add(entry);
        await _db.SaveChangesAsync(ct);

        return Ok(new { sampleFormEntryId = entry.SampleFormEntryId, submittedBy = userName, submittedAt = entry.SubmittedAt });
    }
}

public record AssignFormTemplateRequest(int FormTemplateId);
public record SubmitFormEntryRequest(int FormTemplateId, Dictionary<string, string> FieldValues);

public record ScheduleItemRequest(
    int InstrumentId,
    DateTimeOffset StartTime,
    DateTimeOffset EndTime,
    string? TestName = null);

public record RegisterSampleRequest(
    int     LabId, int MaterialId, string LotNumber,
    DateOnly? MfgDate, DateOnly ExpDate, int SampleTypeId,
    // Phase A receipt fields
    decimal? ReceivedTemp           = null,
    string?  SampleCondition        = null,     // "OK" | "Damaged" | "Compromised"
    bool     IsRush                 = false,
    string?  ExternalBatchId        = null,
    string?  SampleLabel            = null,     // physical label as written on container
    string?  TankSourceId           = null,     // source tank or vessel identifier
    int?     OverrideSpecTemplateId = null,     // set when user manually picks from MultipleMatches
    List<int>? CheckpointIds        = null,
    List<ScheduleItemRequest>? ScheduleItems = null);
public record ReprintBarcodeRequest(string Reason);
public record ApplySpecRequest(int SpecTemplateId);
public record RetestRequest(string RetestReason, List<int>? ParameterIds = null);
public record BatchRegisterEntryRequest(
    int MaterialId, string LotNumber, DateOnly? MfgDate, DateOnly ExpDate, int SampleTypeId,
    decimal? ReceivedTemp = null, string? SampleCondition = null, bool IsRush = false, string? ExternalBatchId = null);
public record BatchRegisterRequest(int LabId, List<BatchRegisterEntryRequest> Entries);

