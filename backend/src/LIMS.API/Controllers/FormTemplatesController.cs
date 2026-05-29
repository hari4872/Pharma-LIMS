using LIMS.Application.Features.MasterData.FormTemplates;
using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LIMS.API.Controllers;

[ApiController]
[Route("api/v1/form-templates")]
[Authorize]
public class FormTemplatesController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly ILimsDbContext _db;

    public FormTemplatesController(IMediator mediator, ILimsDbContext db) { _mediator = mediator; _db = db; }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? status, [FromQuery] string? triggerType)
    {
        var query = _db.FormTemplates.Include(f => f.Locations).Include(f => f.TemplateParameters).Where(f => f.IsActive);
        if (!string.IsNullOrEmpty(status) && Enum.TryParse<FormTemplateStatus>(status, out var st)) query = query.Where(f => f.Status == st);
        if (!string.IsNullOrEmpty(triggerType) && Enum.TryParse<TriggerType>(triggerType, out var tt)) query = query.Where(f => f.TriggerType == tt);

        var results = await query.Include(f => f.SampleTypeNav).Select(f => new
        {
            f.FormTemplateId, f.FormCode, f.FormName, FormType = f.FormType.ToString(),
            TriggerType = f.TriggerType.ToString(), Status = f.Status.ToString(),
            f.Version, f.EvidenceMandatory, f.RegulatoryTier, f.ApprovedBy, f.ApprovedAt,
            f.SampleTypeId, SampleTypeName = f.SampleTypeNav != null ? f.SampleTypeNav.TypeName : null,
            LocationCount = f.Locations.Count, ParameterCount = f.TemplateParameters.Count,
            f.FieldDefinitionsJson
        }).ToListAsync();
        return Ok(results);
    }

    [HttpPost]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> Create([FromBody] CreateFormTemplateRequest request)
    {
        var username = User.Identity?.Name ?? "Unknown";
        var template = new FormTemplate
        {
            FormCode = request.FormCode, FormName = request.FormName, LabId = request.LabId,
            FormType = Enum.Parse<FormType>(request.FormType),
            TriggerType = Enum.Parse<TriggerType>(request.TriggerType),
            TimeSlots = request.TimeSlots, ShiftIntervalHrs = request.ShiftIntervalHrs,
            RegulatoryTier = request.RegulatoryTier, EvidenceMandatory = request.EvidenceMandatory,
            SampleTypeId = request.SampleTypeId,   // configured by user — no hardcoding
            CreatedBy = username, CreatedAt = DateTimeOffset.UtcNow
        };
        _db.FormTemplates.Add(template);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetAll), new { id = template.FormTemplateId }, new { formTemplateId = template.FormTemplateId });
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateFormTemplateRequest request)
    {
        var username = User.Identity?.Name ?? "Unknown";
        var result = await _mediator.Send(new UpdateFormTemplateCommand(id, request.FormName, request.TriggerType, request.EvidenceMandatory, request.RegulatoryTier, request.SampleTypeId, username));
        if (!result.IsSuccess) return result.ErrorCode == "NOT_FOUND" ? NotFound() : BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return Ok(new { formTemplateId = result.Value, status = "Draft" });
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> Deactivate(int id, [FromBody] DeactivateRequest request)
    {
        var username = User.Identity?.Name ?? "Unknown";
        var result = await _mediator.Send(new DeactivateFormTemplateCommand(id, request.Reason, username));
        if (!result.IsSuccess) return result.ErrorCode == "NOT_FOUND" ? NotFound() : BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return Ok(new { formTemplateId = result.Value, status = "Retired" });
    }

    [HttpPost("{id}/approve")]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> Approve(int id, [FromBody] ApproveRequest request)
    {
        var userId = int.Parse(User.FindFirst("sub")?.Value ?? "0");
        var result = await _mediator.Send(new ApproveFormTemplateCommand(id, userId, request.Password, request.Meaning, request.Reason));
        if (!result.IsSuccess)
        {
            if (result.ErrorCode == "ESIGN_AUTH_FAILED") return Unauthorized(new { error = result.ErrorCode, message = result.ErrorMessage });
            return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        }
        return Ok(new { formTemplateId = result.Value, status = "Active" });
    }

    // PUT api/v1/form-templates/{id}/fields  — save custom field designer layout as JSON
    [HttpPut("{id}/fields")]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> SaveFields(int id, [FromBody] SaveFieldsRequest request)
    {
        var template = await _db.FormTemplates.FindAsync(id);
        if (template == null) return NotFound();
        template.FieldDefinitionsJson = request.FieldDefinitionsJson;
        await _db.SaveChangesAsync();
        return Ok(new { formTemplateId = id, fieldCount = string.IsNullOrEmpty(request.FieldDefinitionsJson) ? 0 : System.Text.Json.JsonDocument.Parse(request.FieldDefinitionsJson).RootElement.GetArrayLength() });
    }

    // POST api/v1/form-templates/{id}/parameters
    [HttpPost("{id}/parameters")]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> AddParameter(int id, [FromBody] AddTemplateParameterRequest request)
    {
        var result = await _mediator.Send(new AddFormTemplateParameterCommand(id, request.ParameterId, request.DisplayOrder, request.ColumnFrequency));
        if (!result.IsSuccess) return result.ErrorCode == "NOT_FOUND" ? NotFound() : BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return Ok(new { formTemplateId = result.Value });
    }

    // DELETE api/v1/form-templates/{id}/parameters/{parameterId}
    [HttpDelete("{id}/parameters/{parameterId:int}")]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> RemoveParameter(int id, int parameterId)
    {
        var result = await _mediator.Send(new RemoveFormTemplateParameterCommand(id, parameterId));
        if (!result.IsSuccess) return result.ErrorCode == "NOT_FOUND" ? NotFound() : BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return Ok(new { formTemplateId = result.Value });
    }

    // POST api/v1/form-templates/{id}/locations
    [HttpPost("{id}/locations")]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> AddLocation(int id, [FromBody] AddTemplateLocationRequest request)
    {
        var result = await _mediator.Send(new AddFormTemplateLocationCommand(id, request.LocationName, request.ColumnOrder, request.SpecLimitId));
        if (!result.IsSuccess) return result.ErrorCode == "NOT_FOUND" ? NotFound() : BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return Ok(new { locationId = result.Value });
    }

    // DELETE api/v1/form-templates/{id}/locations/{locationId}
    [HttpDelete("{id}/locations/{locationId:int}")]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> RemoveLocation(int id, int locationId)
    {
        var result = await _mediator.Send(new RemoveFormTemplateLocationCommand(id, locationId));
        if (!result.IsSuccess) return result.ErrorCode == "NOT_FOUND" ? NotFound() : BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return Ok(new { formTemplateId = result.Value });
    }
}

public record CreateFormTemplateRequest(string FormCode, string FormName, int LabId, string FormType, string TriggerType, string? TimeSlots, int? ShiftIntervalHrs, string? RegulatoryTier, bool EvidenceMandatory, int? SampleTypeId);
public record UpdateFormTemplateRequest(string FormName, string TriggerType, bool EvidenceMandatory, string? RegulatoryTier, int? SampleTypeId);
public record SaveFieldsRequest(string? FieldDefinitionsJson);
public record AddTemplateParameterRequest(int ParameterId, int DisplayOrder, string? ColumnFrequency);
public record AddTemplateLocationRequest(string LocationName, int ColumnOrder, int? SpecLimitId);
