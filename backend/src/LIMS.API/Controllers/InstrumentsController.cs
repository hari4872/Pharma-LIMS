using LIMS.API.Pdf;
using LIMS.Application.Features.InstrumentManagement;
using LIMS.Application.Features.MasterData.Instruments;
using LIMS.Application.Interfaces;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QuestPDF.Fluent;
using QuestPDF.Infrastructure;

namespace LIMS.API.Controllers;

[ApiController]
[Route("api/v1/instruments")]
[Authorize]
public class InstrumentsController : LimsControllerBase
{
    private readonly IMediator _mediator;
    private readonly ILimsDbContext _db;
    public InstrumentsController(IMediator mediator, ILimsDbContext db) { _mediator = mediator; _db = db; }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] int? labId, [FromQuery] string? status, [FromQuery] bool includeInactive = false)
        => Ok(await _mediator.Send(new GetInstrumentsQuery(labId, status, includeInactive)));

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Create([FromBody] CreateInstrumentRequest request)
    {
        var username = User.Identity?.Name ?? "Unknown";
        var result = await _mediator.Send(new CreateInstrumentCommand(request.LabId, request.InstrumentCode, request.InstrumentName, request.InstrumentType, request.Manufacturer, request.Model, request.SerialNumber, request.Location, request.CalibrationDue, request.LastCalibration, username));
        if (!result.IsSuccess) return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return CreatedAtAction(nameof(GetAll), new { id = result.Value }, new { instrumentId = result.Value });
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateInstrumentRequest request)
    {
        var username = User.Identity?.Name ?? "Unknown";
        var result = await _mediator.Send(new UpdateInstrumentCommand(id, request.InstrumentName, request.InstrumentType, request.Manufacturer, request.Model, request.SerialNumber, request.Location, request.CalibrationDue, request.LastCalibration, username));
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

    // POST api/v1/instruments/{id}/calibrations â€” create calibration record
    [HttpPost("{id}/calibrations")]
    [Authorize(Roles = "Admin,Analyst")]
    public async Task<IActionResult> CreateCalibration(int id, [FromBody] CreateCalibrationRequest request)
    {
        var username = User.Identity?.Name ?? "Unknown";
        var result = await _mediator.Send(new CreateCalibrationCommand(id, request.CalibrationDate, request.NextCalibrationDue, request.CertificateRef, username));
        if (!result.IsSuccess) return result.ErrorCode == "NOT_FOUND" ? NotFound() : BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return CreatedAtAction(nameof(GetAll), new { id = result.Value }, new { calibrationId = result.Value });
    }

    // POST api/v1/instruments/{id}/calibrations/{calId}/approve â€” QA Â§11.50 e-sig
    [HttpPost("{id}/calibrations/{calId:int}/approve")]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> ApproveCalibration(int id, int calId, [FromBody] ApproveRequest request)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized(new { error = "Invalid token claims." });
        var result = await _mediator.Send(new ApproveCalibrationCommand(calId, userId, request.Password, request.Meaning, request.Reason));
        if (!result.IsSuccess)
        {
            if (result.ErrorCode == "ESIGN_AUTH_FAILED") return Unauthorized(new { error = result.ErrorCode, message = result.ErrorMessage });
            return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        }
        return Ok(new { calibrationId = result.Value, status = "Approved" });
    }

    // â”€â”€ FR-15: Instrument Utilisation Summary â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    // GET api/v1/instruments/{id}/utilisation â€” returns 7/30/90-day windows
    [HttpGet("{id:int}/utilisation")]
    public async Task<IActionResult> GetUtilisation(int id)
        => Ok(await _mediator.Send(new GetInstrumentUtilisationQuery(id)));

    // â”€â”€ FR-13: Breakdown / Repair Lifecycle â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    // GET api/v1/instruments/breakdowns â€” list all (filter by status)
    [HttpGet("breakdowns")]
    public async Task<IActionResult> GetBreakdowns([FromQuery] int? instrumentId, [FromQuery] string? status)
        => Ok(await _mediator.Send(new GetBreakdownsQuery(instrumentId, status)));

    // POST api/v1/instruments/{id}/breakdowns â€” raise breakdown (any role)
    [HttpPost("{id}/breakdowns")]
    public async Task<IActionResult> RaiseBreakdown(int id, [FromBody] RaiseBreakdownRequest request)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized(new { error = "Invalid token claims." });
        var result = await _mediator.Send(new RaiseBreakdownCommand(id, userId, request.IssueDescription));
        if (!result.IsSuccess) return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        var bd = result.Value!;
        return CreatedAtAction(nameof(GetBreakdowns), new { instrumentId = id },
            new { breakdownId = bd.BreakdownId, instrumentStatus = bd.InstrumentStatus });
    }

    // POST api/v1/instruments/breakdowns/{breakdownId}/repairs â€” record repair
    [HttpPost("breakdowns/{breakdownId:int}/repairs")]
    [Authorize(Roles = "Admin,Analyst")]
    public async Task<IActionResult> RecordRepair(int breakdownId, [FromBody] RecordRepairRequest request)
    {
        var username = User.Identity?.Name ?? "Unknown";
        var repairId = await _mediator.Send(new RecordRepairCommand(breakdownId, request.Technician,
            request.RepairDate, request.RepairDescription, request.PartsUsed, username));
        return Ok(new { repairId });
    }

    // POST api/v1/instruments/breakdowns/{breakdownId}/return-to-service â€” QA Â§11.50 e-sig
    [HttpPost("breakdowns/{breakdownId:int}/return-to-service")]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> ReturnToService(int breakdownId, [FromBody] ApproveRequest request)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized(new { error = "Invalid token claims." });
        var result = await _mediator.Send(new ReturnToServiceCommand(breakdownId, userId, request.Password, request.Meaning, request.Reason));
        if (!result.IsSuccess)
        {
            if (result.ErrorCode == "ESIGN_AUTH_FAILED") return Unauthorized(new { error = result.ErrorCode, message = result.ErrorMessage });
            return result.ErrorCode == "NOT_FOUND" ? NotFound() : BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        }
        var rts = result.Value!;
        return Ok(new
        {
            breakdownId,
            signatureId          = rts.SignatureId,
            oocImpactTriggered   = rts.OocImpactTriggered,
            affectedLogbookCount = rts.AffectedLogbookCount
        });
    }

    // GET api/v1/instruments/{id}/calibration-certificate â€” Calibration Certificate PDF (21 CFR 211.68)
    [HttpGet("{id:int}/calibration-certificate")]
    public async Task<IActionResult> GetCalibrationCertificate(int id)
    {
        var inst = await _db.Instruments
            .Include(i => i.Lab)
            .Include(i => i.CalibrationRecords).ThenInclude(c => c.Signature)
            .FirstOrDefaultAsync(i => i.InstrumentId == id);

        if (inst is null) return NotFound();

        var data = new CalibrationCertPdfDocument.CalibrationCertData(
            InstrumentId:   inst.InstrumentId,
            InstrumentCode: inst.InstrumentCode,
            InstrumentType: inst.InstrumentType,
            Model:          inst.Model,
            SerialNumber:   inst.SerialNumber,
            LabName:        inst.Lab.LabName,
            Status:         inst.Status.ToString(),
            CalibrationDue: inst.CalibrationDue,
            GeneratedAt:    DateTimeOffset.UtcNow,
            History: inst.CalibrationRecords
                .OrderByDescending(c => c.CalibrationDate)
                .Select(c => new CalibrationCertPdfDocument.CalibrationHistoryRow(
                    c.CalibrationDate,
                    c.NextCalibrationDue,
                    c.CertificateRef,
                    c.PerformedBy,
                    c.Signature != null ? c.Signature.FullName : null,
                    c.CreatedAt
                )).ToList()
        );

        QuestPDF.Settings.License = LicenseType.Community;
        var doc   = new CalibrationCertPdfDocument(data);
        var bytes = doc.GeneratePdf();
        var fname = $"CalibCert_{inst.InstrumentCode}_{DateTime.UtcNow:yyyy-MM-dd}.pdf";
        return File(bytes, "application/pdf", fname);
    }
}

public record CreateInstrumentRequest(int LabId, string InstrumentCode, string? InstrumentName, string InstrumentType, string? Manufacturer, string? Model, string? SerialNumber, string? Location, DateOnly CalibrationDue, DateOnly? LastCalibration);
public record UpdateInstrumentRequest(string? InstrumentName, string InstrumentType, string? Manufacturer, string? Model, string? SerialNumber, string? Location, DateOnly CalibrationDue, DateOnly? LastCalibration);
public record CreateCalibrationRequest(DateOnly CalibrationDate, DateOnly NextCalibrationDue, string CertificateRef);
public record RaiseBreakdownRequest(string IssueDescription);
public record RecordRepairRequest(string Technician, DateOnly RepairDate, string RepairDescription, string? PartsUsed);

