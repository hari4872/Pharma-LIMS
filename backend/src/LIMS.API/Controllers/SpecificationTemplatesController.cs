using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LIMS.API.Controllers;

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// SpecificationTemplatesController â€” Phase A
//
// CRUD for SpecificationTemplate master data + approval lifecycle.
// QA/Admin manages templates; Analysts have read-only access.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

[ApiController]
[Route("api/v1/specification-templates")]
[Authorize]
public class SpecificationTemplatesController : ControllerBase
{
    private readonly ILimsDbContext _db;
    private readonly ISpecificationEngineService _engine;

    public SpecificationTemplatesController(ILimsDbContext db, ISpecificationEngineService engine)
    {
        _db = db; _engine = engine;
    }

    // â”€â”€ GET /specification-templates â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? status,
        [FromQuery] int? materialId,
        [FromQuery] int? sampleTypeId)
    {
        var q = _db.SpecificationTemplates
            .Include(t => t.Items).ThenInclude(i => i.Parameter)
            .Include(t => t.Items).ThenInclude(i => i.TestMethod)
            .Include(t => t.Material)
            .Include(t => t.SampleType)
            .AsQueryable();

        if (!string.IsNullOrEmpty(status) && Enum.TryParse<SpecTemplateStatus>(status, true, out var st))
            q = q.Where(t => t.Status == st);
        if (materialId.HasValue)   q = q.Where(t => t.MaterialId == materialId);
        if (sampleTypeId.HasValue) q = q.Where(t => t.SampleTypeId == sampleTypeId);

        var list = await q.OrderByDescending(t => t.CreatedAt).Select(t => new
        {
            t.SpecTemplateId, t.TemplateName, t.Version, t.Description,
            t.Stage, t.Status, t.EffectiveFrom, t.ApprovedBy, t.ApprovedAt,
            Material   = new { t.Material.MaterialId, t.Material.MaterialName },
            SampleType = new { t.SampleType.SampleTypeId, t.SampleType.TypeName, t.SampleType.TypeCode },
            t.CreatedBy, t.CreatedAt, t.UpdatedBy, t.UpdatedAt,
            ItemCount  = t.Items.Count,
            Items = t.Items.OrderBy(i => i.SortOrder).Select(i => new
            {
                i.SpecTemplateItemId, i.ParameterId, i.TurnaroundHours, i.IsMandatory, i.SortOrder,
                ParameterName = i.Parameter.ParameterName,
                ParameterCode = i.Parameter.ParameterCode,
                TestMethodName = i.TestMethod != null ? i.TestMethod.MethodName : null,
                TestMethodCode = i.TestMethod != null ? i.TestMethod.MethodCode : null,
            })
        }).ToListAsync();

        return Ok(list);
    }

    // â”€â”€ GET /specification-templates/:id â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var t = await _db.SpecificationTemplates
            .Include(x => x.Items).ThenInclude(i => i.Parameter)
            .Include(x => x.Items).ThenInclude(i => i.TestMethod)
            .Include(x => x.Material)
            .Include(x => x.SampleType)
            .FirstOrDefaultAsync(x => x.SpecTemplateId == id);

        if (t is null) return NotFound();
        return Ok(t);
    }

    // â”€â”€ POST /specification-templates â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    [HttpPost]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> Create([FromBody] CreateSpecTemplateRequest req)
    {
        var user = User.Identity?.Name ?? "system";
        var template = new SpecificationTemplate
        {
            MaterialId   = req.MaterialId,
            SampleTypeId = req.SampleTypeId,
            Stage        = req.Stage,
            TemplateName = req.TemplateName,
            Version      = req.Version ?? "1.0",
            Description  = req.Description,
            Status       = SpecTemplateStatus.Draft,
            EffectiveFrom = req.EffectiveFrom,
            CreatedBy    = user,
            CreatedAt    = DateTimeOffset.UtcNow,
        };

        _db.SpecificationTemplates.Add(template);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = template.SpecTemplateId },
            new { template.SpecTemplateId, template.TemplateName, template.Status });
    }

    // â”€â”€ PUT /specification-templates/:id â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    [HttpPut("{id:int}")]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateSpecTemplateRequest req)
    {
        var template = await _db.SpecificationTemplates.FindAsync(id);
        if (template is null) return NotFound();
        if (template.Status == SpecTemplateStatus.Approved)
            return BadRequest(new { error = "Cannot edit an Approved template. Create a new version instead." });

        template.TemplateName  = req.TemplateName ?? template.TemplateName;
        template.Description   = req.Description  ?? template.Description;
        template.EffectiveFrom = req.EffectiveFrom ?? template.EffectiveFrom;
        template.UpdatedBy     = User.Identity?.Name;
        template.UpdatedAt     = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync();
        return Ok(new { template.SpecTemplateId, template.TemplateName, template.Status });
    }

    // â”€â”€ PUT /specification-templates/:id/items â€” save full item list â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    [HttpPut("{id:int}/items")]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> SaveItems(int id, [FromBody] List<SaveSpecItemRequest> items)
    {
        var template = await _db.SpecificationTemplates
            .Include(t => t.Items)
            .FirstOrDefaultAsync(t => t.SpecTemplateId == id);
        if (template is null) return NotFound();
        if (template.Status == SpecTemplateStatus.Approved)
            return BadRequest(new { error = "Cannot edit items on an Approved template." });

        var user = User.Identity?.Name ?? "system";

        // Remove all existing items and replace (simple replace strategy)
        _db.SpecTemplateItems.RemoveRange(template.Items);

        foreach (var (item, idx) in items.Select((x, i) => (x, i)))
        {
            _db.SpecTemplateItems.Add(new SpecTemplateItem
            {
                SpecTemplateId  = id,
                ParameterId     = item.ParameterId,
                TestMethodId    = item.TestMethodId,
                TurnaroundHours = item.TurnaroundHours > 0 ? item.TurnaroundHours : 24,
                IsMandatory     = item.IsMandatory,
                SortOrder       = idx,
                CreatedBy       = user,
                CreatedAt       = DateTimeOffset.UtcNow,
            });
        }

        template.UpdatedBy = user;
        template.UpdatedAt = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync();
        return Ok(new { specTemplateId = id, itemCount = items.Count });
    }

    // â”€â”€ POST /specification-templates/:id/approve â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    [HttpPost("{id:int}/approve")]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> Approve(int id)
    {
        var template = await _db.SpecificationTemplates
            .Include(t => t.Items)
            .FirstOrDefaultAsync(t => t.SpecTemplateId == id);
        if (template is null) return NotFound();
        if (template.Items.Count == 0)
            return BadRequest(new { error = "Cannot approve a template with no test items. Add at least one test." });
        if (template.Status == SpecTemplateStatus.Approved)
            return BadRequest(new { error = "Template is already Approved." });

        // Enforce uniqueness â€” only one Approved per Material+SampleType+Stage
        var existingApproved = await _db.SpecificationTemplates.AnyAsync(t =>
            t.MaterialId   == template.MaterialId   &&
            t.SampleTypeId == template.SampleTypeId &&
            t.Stage        == template.Stage        &&
            t.Status       == SpecTemplateStatus.Approved &&
            t.SpecTemplateId != id);

        if (existingApproved)
            return Conflict(new { error = "An Approved specification already exists for this Material / Sample Type / Stage combination. Obsolete it first before approving a replacement." });

        var user = User.Identity?.Name ?? "system";
        template.Status     = SpecTemplateStatus.Approved;
        template.ApprovedBy = user;
        template.ApprovedAt = DateTimeOffset.UtcNow;
        template.UpdatedBy  = user;
        template.UpdatedAt  = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync();
        return Ok(new { template.SpecTemplateId, template.Status, template.ApprovedAt });
    }

    // â”€â”€ POST /specification-templates/:id/obsolete â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    [HttpPost("{id:int}/obsolete")]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> Obsolete(int id)
    {
        var template = await _db.SpecificationTemplates.FindAsync(id);
        if (template is null) return NotFound();
        if (template.Status == SpecTemplateStatus.Obsolete)
            return BadRequest(new { error = "Template is already Obsolete." });

        var user = User.Identity?.Name ?? "system";
        template.Status    = SpecTemplateStatus.Obsolete;
        template.UpdatedBy = user;
        template.UpdatedAt = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync();
        return Ok(new { template.SpecTemplateId, template.Status });
    }

    // â”€â”€ GET /specification-templates/match â€” preview spec engine result â”€â”€â”€â”€â”€â”€â”€
    [HttpGet("match")]
    public async Task<IActionResult> Match(
        [FromQuery] int materialId,
        [FromQuery] int sampleTypeId,
        [FromQuery] string stage)
    {
        if (!Enum.TryParse<SpecStage>(stage, true, out var stageEnum))
            return BadRequest(new { error = "Invalid stage value. Use: Incoming, InProcess, Finished, Stability." });

        var result = await _engine.MatchAsync(materialId, sampleTypeId, stageEnum);
        return Ok(new
        {
            outcome    = result.Outcome.ToString(),
            templateId = result.TemplateId,
            candidates = result.Candidates,
            message    = result.Message,
        });
    }
}

// â”€â”€ Request DTOs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

public record CreateSpecTemplateRequest(
    int       MaterialId,
    int       SampleTypeId,
    SpecStage Stage,
    string    TemplateName,
    string?   Version,
    string?   Description,
    DateTimeOffset? EffectiveFrom);

public record UpdateSpecTemplateRequest(
    string?         TemplateName,
    string?         Description,
    DateTimeOffset? EffectiveFrom);

public record SaveSpecItemRequest(
    int  ParameterId,
    int? TestMethodId,
    int  TurnaroundHours,
    bool IsMandatory);

