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

        var results = await query.Select(f => new
        {
            f.FormTemplateId, f.FormCode, f.FormName, FormType = f.FormType.ToString(),
            TriggerType = f.TriggerType.ToString(), Status = f.Status.ToString(),
            f.Version, f.EvidenceMandatory, f.RegulatoryTier, f.ApprovedBy, f.ApprovedAt,
            LocationCount = f.Locations.Count, ParameterCount = f.TemplateParameters.Count
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
            CreatedBy = username, CreatedAt = DateTimeOffset.UtcNow
        };
        _db.FormTemplates.Add(template);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetAll), new { id = template.FormTemplateId }, new { formTemplateId = template.FormTemplateId });
    }

    [HttpPost("{id}/approve")]
    [Authorize(Roles = "QA")]
    public async Task<IActionResult> Approve(int id, [FromBody] ApproveRequest request)
    {
        var userId = int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "0");
        var result = await _mediator.Send(new ApproveFormTemplateCommand(id, userId, request.Password, request.Meaning, request.Reason));
        if (!result.IsSuccess)
        {
            if (result.ErrorCode == "ESIGN_AUTH_FAILED") return Unauthorized(new { error = result.ErrorCode, message = result.ErrorMessage });
            return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        }
        return Ok(new { formTemplateId = result.Value, status = "Active" });
    }
}

public record CreateFormTemplateRequest(string FormCode, string FormName, int LabId, string FormType, string TriggerType, string? TimeSlots, int? ShiftIntervalHrs, string? RegulatoryTier, bool EvidenceMandatory);
