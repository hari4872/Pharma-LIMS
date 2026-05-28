using LIMS.API.Pdf;
using LIMS.Application.Features.OosInvestigations;
using LIMS.Application.Interfaces;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QuestPDF.Fluent;
using QuestPDF.Infrastructure;

namespace LIMS.API.Controllers;

[ApiController]
[Route("api/v1/oos-investigations")]
[Authorize]
public class OosInvestigationsController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly ILimsDbContext _db;
    public OosInvestigationsController(IMediator mediator, ILimsDbContext db)
    { _mediator = mediator; _db = db; }

    // GET api/v1/oos-investigations?status=Open&labId=1&executionId=5
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? status, [FromQuery] int? labId, [FromQuery] int? executionId)
        => Ok(await _mediator.Send(new GetOosInvestigationsQuery(status, labId, executionId)));

    // POST api/v1/oos-investigations/{id}/close — QA closes investigation §11.50 e-sig (FDA OOS Guidance)
    [HttpPost("{id}/close")]
    [Authorize(Roles = "Admin,QA,QCLead")]
    public async Task<IActionResult> Close(int id, [FromBody] CloseOosRequest request)
    {
        var userId = int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "0");
        var result = await _mediator.Send(new CloseOosInvestigationCommand(
            id, userId, request.RootCause, request.CapaRef, request.Password, request.Meaning, request.Reason));
        if (!result.IsSuccess)
        {
            if (result.ErrorCode == "ESIGN_AUTH_FAILED") return Unauthorized(new { error = result.ErrorCode, message = result.ErrorMessage });
            if (result.ErrorCode == "NOT_FOUND") return NotFound();
            return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        }
        return Ok(new { investigationId = result.Value, status = "Closed" });
    }

    // POST api/v1/oos-investigations/{id}/escalate-phase2 — Sprint 1: FDA OOS Phase 2 escalation
    [HttpPost("{id}/escalate-phase2")]
    [Authorize(Roles = "Admin,QA,QCLead")]
    public async Task<IActionResult> EscalateToPhase2(int id, [FromBody] EscalatePhase2Request request)
    {
        var userId = int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "0");
        var result = await _mediator.Send(new EscalateToPhase2Command(
            id, userId, request.EscalationReason, request.CapaRef,
            request.Password, request.Meaning, request.Reason));
        if (!result.IsSuccess)
        {
            if (result.ErrorCode == "ESIGN_AUTH_FAILED") return Unauthorized(new { error = result.ErrorCode, message = result.ErrorMessage });
            if (result.ErrorCode == "NOT_FOUND") return NotFound();
            return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        }
        return Ok(new { investigationId = result.Value, phase = "Phase2" });
    }

    // GET api/v1/oos-investigations/{id}/pdf — OOS Investigation Report PDF (FDA OOS Guidance + 21 CFR §211.192)
    [HttpGet("{id}/pdf")]
    public async Task<IActionResult> GetPdf(int id)
    {
        var inv = await _db.OosInvestigations
            .Include(i => i.Execution).ThenInclude(e => e.Sample).ThenInclude(s => s.Material)
            .Include(i => i.Entry).ThenInclude(e => e.Analyst)
            .Include(i => i.Parameter)
            .Include(i => i.Signature).ThenInclude(s => s!.User)
            .FirstOrDefaultAsync(i => i.InvestigationId == id);

        if (inv is null) return NotFound();

        var data = new OosPdfDocument.OosReportData(
            InvestigationId: inv.InvestigationId,
            SampleNumber:    inv.Execution.Sample.SampleNumber,
            MaterialName:    inv.Execution.Sample.Material.MaterialName,
            LotNumber:       inv.Execution.Sample.LotNumber,
            ParameterName:   inv.Parameter.ParameterName,
            Uom:             inv.Parameter.Uom ?? "—",
            FlagType:        inv.FlagType.ToString(),
            Phase:           inv.Phase.ToString(),
            Status:          inv.Status.ToString(),
            RawValue:        inv.Entry.RawValue,
            CalculatedResult: inv.Entry.CalculatedResult,
            SpecMin:         inv.Entry.SpecMinSnapshot,
            SpecMax:         inv.Entry.SpecMaxSnapshot,
            PassFail:        inv.Entry.PassFail,
            AnalystName:     inv.Entry.Analyst?.FullName ?? "Unknown",
            RootCause:       inv.RootCause,
            CapaRef:         inv.CapaRef,
            CreatedBy:       inv.CreatedBy,
            OpenedAt:        inv.OpenedAt,
            ClosedAt:        inv.ClosedAt,
            ClosedByName:    inv.Signature?.FullName
        );

        QuestPDF.Settings.License = LicenseType.Community;
        var doc   = new OosPdfDocument(data);
        var bytes = doc.GeneratePdf();
        var fname = $"OOS_{inv.InvestigationId:D5}_{inv.Execution.Sample.SampleNumber}.pdf";
        return File(bytes, "application/pdf", fname);
    }
}

public record CloseOosRequest(string RootCause, string? CapaRef, string Password, string Meaning, string Reason);
public record EscalatePhase2Request(string EscalationReason, string? CapaRef, string Password, string Meaning, string Reason);
