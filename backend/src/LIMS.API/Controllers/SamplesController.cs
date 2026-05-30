using LIMS.Application.Features.Samples;
using LIMS.Application.Interfaces;
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
    public SamplesController(IMediator mediator, ILimsDbContext db, ISpecificationEngineService specEngine)
    { _mediator = mediator; _db = db; _specEngine = specEngine; }

    // GET api/v1/samples?labId=1&status=PendingTesting
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] int? labId, [FromQuery] string? status, [FromQuery] int? analystId)
        => Ok(await _mediator.Send(new GetSamplesQuery(labId, status, analystId)));

    // POST api/v1/samples â€” FR-01: unified entry for both manual and checkpoint auto-trigger
    [HttpPost]
    [Authorize(Roles = "Admin,QA,Analyst")]
    public async Task<IActionResult> Register([FromBody] RegisterSampleRequest request)
    {
        var username = User.Identity?.Name ?? "Unknown";
        if (!TryGetUserId(out var userId)) return Unauthorized(new { error = "Invalid token claims." });
        var result   = await _mediator.Send(new RegisterSampleCommand(
            request.LabId, request.MaterialId, request.LotNumber,
            request.MfgDate, request.ExpDate, request.SampleTypeId,
            userId, username,
            // Phase A fields
            request.ReceivedTemp, request.SampleCondition, request.IsRush,
            request.ExternalBatchId, request.SampleLabel, request.TankSourceId,
            request.OverrideSpecTemplateId, request.CheckpointIds));

        if (!result.IsSuccess) return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });

        var v = result.Value!;
        return CreatedAtAction(nameof(GetAll), new { id = v.SampleId }, new
        {
            v.SampleId, v.SampleNumber,
            v.SpecOutcome, v.SpecMessage, v.TestsAutoCreated
        });
    }

    // POST api/v1/samples/{id}/sign-srf â€” Step 7: SRF Â§11.50 e-sig â†’ PendingTesting (FR-09)
    [HttpPost("{id}/sign-srf")]
    [Authorize(Roles = "Admin,Analyst,QA")]
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

    // POST api/v1/samples/{id}/barcode-reprint â€” FR-18: audit-logged reprint with mandatory reason
    [HttpPost("{id}/barcode-reprint")]
    [Authorize(Roles = "Admin,Analyst")]
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

    // GET api/v1/samples/{id} — full sample detail with related executions (single query)
    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        var sample = await _db.Samples
            .Where(s => s.SampleId == id)
            .Include(s => s.Material)
            .Include(s => s.SampleTypeNav)
            .Include(s => s.SpecTemplate)
            .Include(s => s.TestExecutions).ThenInclude(e => e.Analyst)
            .Include(s => s.TestExecutions).ThenInclude(e => e.Instrument)
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
            SampleCondition  = sample.SampleCondition != null ? sample.SampleCondition.ToString() : null,
            sample.ExternalBatchId,
            SpecTemplateName = sample.SpecTemplate != null ? sample.SpecTemplate.TemplateName : null,
            sample.SpecTemplateId,
            TestExecutions = sample.TestExecutions
                .OrderBy(e => e.PriorityScore ?? 999)
                .Select(e => new {
                    e.ExecutionId,
                    Status         = e.Status.ToString(),
                    AnalystName    = e.Analyst != null ? e.Analyst.FullName : "—",
                    InstrumentCode = e.Instrument != null ? e.Instrument.InstrumentCode : "—",
                    e.PriorityScore, e.StartedAt, e.CompletedAt, DueDate = e.DueAt
                }).ToList()
        });
    }

    // POST api/v1/samples/{id}/apply-spec
    [HttpPost("{id}/apply-spec")]
    [Authorize(Roles = "Admin,QA,Analyst")]
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
}

public record RegisterSampleRequest(
    int     LabId, int MaterialId, string LotNumber,
    DateOnly MfgDate, DateOnly ExpDate, int SampleTypeId,
    // Phase A receipt fields
    decimal? ReceivedTemp           = null,
    string?  SampleCondition        = null,     // "OK" | "Damaged" | "Compromised"
    bool     IsRush                 = false,
    string?  ExternalBatchId        = null,
    string?  SampleLabel            = null,     // physical label as written on container
    string?  TankSourceId           = null,     // source tank or vessel identifier
    int?     OverrideSpecTemplateId = null,     // set when user manually picks from MultipleMatches
    List<int>? CheckpointIds        = null);
public record ReprintBarcodeRequest(string Reason);
public record ApplySpecRequest(int SpecTemplateId);

