using LIMS.API.Pdf;
using LIMS.Application.Features.CoA;
using LIMS.Application.Interfaces;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QuestPDF.Fluent;
using QuestPDF.Infrastructure;

namespace LIMS.API.Controllers;

[ApiController]
[Route("api/v1/coas")]
[Authorize]
public class CoAController : LimsControllerBase
{
    private readonly IMediator _mediator;
    private readonly IQAReviewGateService _qaGate;
    private readonly ILimsDbContext _db;
    public CoAController(IMediator mediator, IQAReviewGateService qaGate, ILimsDbContext db)
    { _mediator = mediator; _qaGate = qaGate; _db = db; }


    // GET api/v1/coas?sampleId=&status=
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] int? sampleId, [FromQuery] string? status)
    {
        var result = await _mediator.Send(new GetCoAQuery(sampleId, status));
        return Ok(result);
    }

    // GET api/v1/coas/{id}
    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var result = await _mediator.Send(new GetCoAQuery(null, null, CoaId: id));
        var coa = result.FirstOrDefault();
        if (coa is null) return NotFound();
        return Ok(coa);
    }

    // GET api/v1/coas/{id}/checklist � evaluate all 10 QA checklist items (vw_qa_checklist)
    [HttpGet("{id}/checklist")]
    [Authorize(Roles = "QA,Admin,LabManager")]
    public async Task<IActionResult> GetChecklist(int id)
    {
        var result = await _mediator.Send(new GetCoAQuery(null, null, CoaId: id));
        var coa = result.FirstOrDefault();
        if (coa is null) return NotFound();
        var checklist = await _qaGate.EvaluateChecklistAsync(coa.SampleId, id);
        return Ok(checklist);
    }

    // POST api/v1/coas/generate � manual CoA generation trigger (auto-trigger is via QCLead verify)
    [HttpPost("generate")]
    [Authorize(Roles = "LabManager,QA,Admin")]
    public async Task<IActionResult> Generate([FromBody] GenerateCoARequest request)
    {
        var result = await _mediator.Send(new GenerateCoACommand(request.SampleId, request.ExecutionId));
        if (!result.IsSuccess) return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return Ok(new { coaId = result.Value });
    }

    // POST api/v1/coas/{id}/approve � QA §11.50 approval, locks PDF atomically
    [HttpPost("{id}/approve")]
    [Authorize(Roles = "QA,Admin,LabManager")]
    public async Task<IActionResult> Approve(int id, [FromBody] CoASignRequest request)
    {
        if (!TryGetUserId(out var qaUserId)) return Unauthorized(new { error = "Invalid token claims." });
        var result = await _mediator.Send(new ApproveCoACommand(id, qaUserId,
            request.Password, request.Meaning, request.Reason,
            request.IsConditionalRelease, request.ConditionalJustification));
        if (!result.IsSuccess)
        {
            if (result.ErrorCode == "ESIGN_AUTH_FAILED") return Unauthorized(new { error = result.ErrorCode, message = result.ErrorMessage });
            return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        }
        return Ok(new { approvalId = result.Value, decision = "Approved" });
    }

    // GET api/v1/coas/{id}/pdf � generate and download CoA PDF (on-the-fly, QuestPDF)
    [HttpGet("{id}/pdf")]
    public async Task<IActionResult> GetPdf(int id)
    {
        var result = await _mediator.Send(new GetCoAQuery(null, null, CoaId: id));
        var coa = result.FirstOrDefault();
        if (coa is null) return NotFound();

        if (coa.Status == "Draft")
            return BadRequest(new { error = "DRAFT_COA", message = "CoA must be approved (Released) before the PDF can be downloaded." });

        // Fetch logo from lab_config (optional — CoA renders without it)
        string? logoBase64 = null;
        var labId = await _db.Samples.Where(s => s.SampleId == coa.SampleId)
            .Select(s => s.LabId).FirstOrDefaultAsync();
        var logoCfg = await _db.LabConfigs
            .Where(c => c.LabId == labId && c.ConfigKey == "coa_logo_base64")
            .OrderByDescending(c => c.UpdatedAt)
            .FirstOrDefaultAsync();
        if (logoCfg is not null) logoBase64 = logoCfg.ConfigValue;

        // Generate PDF on-the-fly using QuestPDF (Community license)
        QuestPDF.Settings.License = LicenseType.Community;
        var doc   = new CoAPdfDocument(coa, logoBase64);
        var bytes = doc.GeneratePdf();

        return File(bytes, "application/pdf", $"CoA_{coa.CoaNumber}.pdf");
    }

    // POST api/v1/coas/{id}/reissue — creates superseding CoA (FR-11)
    // 21 CFR §11.50: e-signature required — superseding a Released record is a regulated action
    [HttpPost("{id}/reissue")]
    [Authorize(Roles = "QA,Admin")]
    public async Task<IActionResult> Reissue(int id, [FromBody] ReissueCoARequest request)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized(new { error = "Invalid token claims." });
        var result = await _mediator.Send(new ReissueCoACommand(id, userId, request.Password, request.Meaning, request.Reason));
        if (!result.IsSuccess)
        {
            if (result.ErrorCode == "ESIGN_AUTH_FAILED") return Unauthorized(new { error = result.ErrorCode, message = result.ErrorMessage });
            return result.ErrorCode == "NOT_FOUND" ? NotFound() : BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        }
        return Ok(new { newCoaId = result.Value, supersededCoaId = id });
    }

    // POST api/v1/coas/{id}/reject � QA rejection + justification, INSERT-only (EU Annex 11 §13)
    [HttpPost("{id}/reject")]
    [Authorize(Roles = "QA,Admin,LabManager")]
    public async Task<IActionResult> Reject(int id, [FromBody] CoARejectRequest request)
    {
        if (!TryGetUserId(out var qaUserId)) return Unauthorized(new { error = "Invalid token claims." });
        var result = await _mediator.Send(new RejectCoACommand(id, qaUserId,
            request.Justification, request.Password, request.Meaning, request.Reason));
        if (!result.IsSuccess)
        {
            if (result.ErrorCode == "ESIGN_AUTH_FAILED") return Unauthorized(new { error = result.ErrorCode, message = result.ErrorMessage });
            return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        }
        return Ok(new { approvalId = result.Value, decision = "Rejected" });
    }
}

public record GenerateCoARequest(int SampleId, int ExecutionId);
public record CoASignRequest(string Password, string Meaning, string Reason,
    bool IsConditionalRelease = false, string? ConditionalJustification = null);
public record CoARejectRequest(string Justification, string Password, string Meaning, string Reason);
public record ReissueCoARequest(string Password, string Meaning, string Reason);

