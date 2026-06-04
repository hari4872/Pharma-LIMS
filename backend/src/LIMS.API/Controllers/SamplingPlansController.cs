using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LIMS.API.Controllers;

// â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
// SamplingPlansController — Phase B
//
// CRUD for SamplingPlan master data.
// QA/Admin manages plans; all authenticated users can read.
// â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

[ApiController]
[Route("api/v1/sampling-plans")]
[Authorize]
public class SamplingPlansController : ControllerBase
{
    private readonly ILimsDbContext _db;

    public SamplingPlansController(ILimsDbContext db) => _db = db;

    // â"€â"€ GET /sampling-plans â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] int? materialId,
        [FromQuery] int? sampleTypeId,
        [FromQuery] string? stage,
        [FromQuery] bool? isActive)
    {
        var q = _db.SamplingPlans
            .Include(p => p.Material)
            .Include(p => p.SampleType)
            .Include(p => p.SpecTemplate)
            .AsQueryable();

        if (materialId.HasValue)   q = q.Where(p => p.MaterialId == materialId);
        if (sampleTypeId.HasValue) q = q.Where(p => p.SampleTypeId == sampleTypeId);
        if (!string.IsNullOrEmpty(stage) && Enum.TryParse<SpecStage>(stage, true, out var st))
            q = q.Where(p => p.Stage == st);
        if (isActive.HasValue) q = q.Where(p => p.IsActive == isActive);

        var list = await q.OrderByDescending(p => p.CreatedAt).Select(p => new
        {
            p.SamplingPlanId, p.PlanName, p.Stage, p.Frequency,
            p.IntervalHours, p.SamplesPerPull, p.Notes, p.IsActive,
            p.CreatedBy, p.CreatedAt, p.UpdatedBy, p.UpdatedAt,
            Material     = new { p.Material.MaterialId, p.Material.MaterialName },
            SampleType   = new { p.SampleType.SampleTypeId, p.SampleType.TypeName, p.SampleType.TypeCode },
            SpecTemplate = p.SpecTemplate == null ? null : new { p.SpecTemplate.SpecTemplateId, p.SpecTemplate.TemplateName },
        }).ToListAsync();

        return Ok(list);
    }

    // â"€â"€ GET /sampling-plans/:id â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var p = await _db.SamplingPlans
            .Include(x => x.Material)
            .Include(x => x.SampleType)
            .Include(x => x.SpecTemplate)
            .FirstOrDefaultAsync(x => x.SamplingPlanId == id);
        if (p is null) return NotFound();
        return Ok(p);
    }

    // â"€â"€ POST /sampling-plans â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
    [HttpPost]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> Create([FromBody] CreateSamplingPlanRequest req)
    {
        var user = User.Identity?.Name ?? "system";
        var plan = new SamplingPlan
        {
            PlanName       = req.PlanName,
            MaterialId     = req.MaterialId,
            SampleTypeId   = req.SampleTypeId,
            Stage          = req.Stage,
            Frequency      = req.Frequency,
            IntervalHours  = req.IntervalHours,
            SamplesPerPull = req.SamplesPerPull > 0 ? req.SamplesPerPull : 1,
            SpecTemplateId = req.SpecTemplateId,
            Notes          = req.Notes,
            IsActive       = true,
            CreatedBy      = user,
            CreatedAt      = DateTimeOffset.UtcNow,
        };
        _db.SamplingPlans.Add(plan);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = plan.SamplingPlanId },
            new { plan.SamplingPlanId, plan.PlanName });
    }

    // â"€â"€ PUT /sampling-plans/:id â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
    [HttpPut("{id:int}")]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateSamplingPlanRequest req)
    {
        var plan = await _db.SamplingPlans.FindAsync(id);
        if (plan is null) return NotFound();

        plan.PlanName       = req.PlanName       ?? plan.PlanName;
        plan.Frequency      = req.Frequency      ?? plan.Frequency;
        plan.IntervalHours  = req.IntervalHours  ?? plan.IntervalHours;
        plan.SamplesPerPull = req.SamplesPerPull > 0 ? req.SamplesPerPull : plan.SamplesPerPull;
        plan.SpecTemplateId = req.SpecTemplateId ?? plan.SpecTemplateId;
        plan.Notes          = req.Notes          ?? plan.Notes;
        plan.IsActive       = req.IsActive       ?? plan.IsActive;
        plan.UpdatedBy      = User.Identity?.Name;
        plan.UpdatedAt      = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync();
        return Ok(new { plan.SamplingPlanId, plan.PlanName, plan.IsActive });
    }

    // â"€â"€ DELETE /sampling-plans/:id â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> Delete(int id)
    {
        var plan = await _db.SamplingPlans.FindAsync(id);
        if (plan is null) return NotFound();
        _db.SamplingPlans.Remove(plan);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}

// â"€â"€ Request DTOs â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

public record CreateSamplingPlanRequest(
    string       PlanName,
    int          MaterialId,
    int          SampleTypeId,
    SpecStage    Stage,
    FrequencyType Frequency,
    int?         IntervalHours,
    int          SamplesPerPull,
    int?         SpecTemplateId,
    string?      Notes);

public record UpdateSamplingPlanRequest(
    string?        PlanName,
    FrequencyType? Frequency,
    int?           IntervalHours,
    int            SamplesPerPull,
    int?           SpecTemplateId,
    string?        Notes,
    bool?          IsActive);

