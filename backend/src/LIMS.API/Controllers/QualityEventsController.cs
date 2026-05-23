using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LIMS.API.Controllers;

/// <summary>
/// Sprint 1 — Unified Quality Events: CAPA · Deviations · Complaints
/// Single controller, type-filtered via CdType query param.
/// Route: api/v1/quality-events
/// </summary>
[ApiController]
[Route("api/v1/quality-events")]
[Authorize]
public class QualityEventsController : ControllerBase
{
    private readonly ILimsDbContext _db;
    private readonly ILabContext _lab;

    public QualityEventsController(ILimsDbContext db, ILabContext lab)
    { _db = db; _lab = lab; }

    // GET api/v1/quality-events?type=Capa&status=Open&labId=1&sampleId=5
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? type,
        [FromQuery] string? status,
        [FromQuery] int? labId,
        [FromQuery] int? sampleId,
        [FromQuery] string? priority)
    {
        var q = _db.ComplaintsDeviations
            .Include(e => e.Sample)
            .Include(e => e.AssignedTo)
            .Include(e => e.Lab)
            .AsQueryable();

        // Lab isolation (MS-1): lab users see only their lab
        if (!_lab.IsCrossLab && _lab.LabId.HasValue)
            q = q.Where(e => e.LabId == _lab.LabId || e.LabId == null);

        if (!string.IsNullOrWhiteSpace(type) && Enum.TryParse<CdType>(type, true, out var cdType))
            q = q.Where(e => e.CdType == cdType);

        if (!string.IsNullOrWhiteSpace(status))
            q = q.Where(e => e.Status == status);

        if (labId.HasValue)
            q = q.Where(e => e.LabId == labId);

        if (sampleId.HasValue)
            q = q.Where(e => e.SampleId == sampleId);

        if (!string.IsNullOrWhiteSpace(priority))
            q = q.Where(e => e.Priority == priority);

        var results = await q
            .OrderByDescending(e => e.OpenedAt)
            .Select(e => new
            {
                e.CdId,
                cdType         = e.CdType.ToString(),
                e.CdReference,
                e.Title,
                e.Description,
                e.Status,
                e.Priority,
                e.RootCause,
                e.CorrectiveAction,
                e.PreventiveAction,
                e.SampleId,
                sampleNumber   = e.Sample != null ? e.Sample.SampleNumber : null,
                e.AssignedToUserId,
                assignedToName = e.AssignedTo != null ? e.AssignedTo.FullName : null,
                e.LabId,
                labName        = e.Lab != null ? e.Lab.LabName : null,
                e.LinkedOosId,
                e.DueDate,
                e.OpenedBy,
                e.OpenedAt,
                e.ResolvedAt,
                e.ResolvedBy,
            })
            .ToListAsync();

        return Ok(results);
    }

    // GET api/v1/quality-events/{id}
    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var e = await _db.ComplaintsDeviations
            .Include(e => e.Sample)
            .Include(e => e.AssignedTo)
            .Include(e => e.Lab)
            .Include(e => e.LinkedOos)
            .FirstOrDefaultAsync(e => e.CdId == id);

        if (e is null) return NotFound();

        return Ok(new
        {
            e.CdId,
            cdType            = e.CdType.ToString(),
            e.CdReference,
            e.Title,
            e.Description,
            e.Status,
            e.Priority,
            e.RootCause,
            e.CorrectiveAction,
            e.PreventiveAction,
            e.SampleId,
            sampleNumber      = e.Sample?.SampleNumber,
            e.AssignedToUserId,
            assignedToName    = e.AssignedTo?.FullName,
            e.LabId,
            labName           = e.Lab?.LabName,
            e.LinkedOosId,
            e.DueDate,
            e.OpenedBy,
            e.OpenedAt,
            e.ResolvedAt,
            e.ResolvedBy,
            e.UpdatedBy,
            e.UpdatedAt,
        });
    }

    // POST api/v1/quality-events — create CAPA / Deviation / Complaint
    [HttpPost]
    [Authorize(Roles = "Admin,QA,QCLead,LabManager")]
    public async Task<IActionResult> Create([FromBody] CreateQualityEventRequest req)
    {
        if (!Enum.TryParse<CdType>(req.CdType, true, out var cdType))
            return BadRequest(new { error = "Invalid CdType. Use: Capa, Deviation, Complaint" });

        // Auto-generate reference number: CAPA-20260523-0001
        var prefix = cdType switch { CdType.Capa => "CAPA", CdType.Deviation => "DEV", _ => "COMP" };
        var today  = DateTimeOffset.UtcNow.ToString("yyyyMMdd");
        var count  = await _db.ComplaintsDeviations.CountAsync(e => e.CdType == cdType) + 1;
        var refNo  = $"{prefix}-{today}-{count:D4}";

        var entity = new ComplaintsDeviation
        {
            CdType           = cdType,
            CdReference      = refNo,
            Title            = req.Title,
            Description      = req.Description,
            Status           = "Open",
            Priority         = req.Priority ?? "Medium",
            RootCause        = req.RootCause,
            CorrectiveAction = req.CorrectiveAction,
            PreventiveAction = req.PreventiveAction,
            SampleId         = req.SampleId,
            AssignedToUserId = req.AssignedToUserId,
            LabId            = req.LabId ?? (_lab.IsCrossLab ? null : _lab.LabId),
            LinkedOosId      = req.LinkedOosId,
            DueDate          = req.DueDate.HasValue ? DateOnly.FromDateTime(req.DueDate.Value) : null,
            OpenedBy         = _lab.UserId > 0 ? _lab.UserId.ToString() : (User.Identity?.Name ?? "System"),
            OpenedAt         = DateTimeOffset.UtcNow,
        };

        _db.ComplaintsDeviations.Add(entity);
        await _db.SaveChangesAsync();

        return Ok(new { entity.CdId, entity.CdReference, status = "Open" });
    }

    // PUT api/v1/quality-events/{id}
    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,QA,QCLead,LabManager")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateQualityEventRequest req)
    {
        var entity = await _db.ComplaintsDeviations.FindAsync(id);
        if (entity is null) return NotFound();
        if (entity.Status == "Closed")
            return BadRequest(new { error = "Cannot modify a closed quality event." });

        if (!string.IsNullOrWhiteSpace(req.Title))            entity.Title            = req.Title;
        if (req.Description != null)                          entity.Description      = req.Description;
        if (!string.IsNullOrWhiteSpace(req.Status))          entity.Status           = req.Status;
        if (!string.IsNullOrWhiteSpace(req.Priority))        entity.Priority         = req.Priority;
        if (req.RootCause != null)                            entity.RootCause        = req.RootCause;
        if (req.CorrectiveAction != null)                     entity.CorrectiveAction = req.CorrectiveAction;
        if (req.PreventiveAction != null)                     entity.PreventiveAction = req.PreventiveAction;
        if (req.AssignedToUserId.HasValue)                    entity.AssignedToUserId = req.AssignedToUserId;
        if (req.DueDate.HasValue)                             entity.DueDate          = DateOnly.FromDateTime(req.DueDate.Value);

        // Close event
        if (req.Status is "Closed" or "Verified")
        {
            entity.ResolvedAt = DateTimeOffset.UtcNow;
            entity.ResolvedBy = User.Identity?.Name ?? "Unknown";
        }

        entity.UpdatedBy = User.Identity?.Name ?? "Unknown";
        entity.UpdatedAt = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync();
        return Ok(new { entity.CdId, entity.Status });
    }

    // DELETE api/v1/quality-events/{id} — Admin only, soft-via status = Void
    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Void(int id)
    {
        var entity = await _db.ComplaintsDeviations.FindAsync(id);
        if (entity is null) return NotFound();

        entity.Status    = "Void";
        entity.UpdatedBy = User.Identity?.Name ?? "Admin";
        entity.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(new { message = "Quality event voided." });
    }
}

public record CreateQualityEventRequest(
    string CdType,
    string Title,
    string? Description,
    string? Priority,
    string? RootCause,
    string? CorrectiveAction,
    string? PreventiveAction,
    int? SampleId,
    int? AssignedToUserId,
    int? LabId,
    int? LinkedOosId,
    DateTime? DueDate);

public record UpdateQualityEventRequest(
    string? Title,
    string? Description,
    string? Status,
    string? Priority,
    string? RootCause,
    string? CorrectiveAction,
    string? PreventiveAction,
    int? AssignedToUserId,
    DateTime? DueDate);
