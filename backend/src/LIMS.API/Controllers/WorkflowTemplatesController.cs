using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LIMS.API.Controllers;

[ApiController]
[Route("api/v1/workflow-templates")]
[Authorize]
public class WorkflowTemplatesController : ControllerBase
{
    private readonly ILimsDbContext _db;
    private readonly IWorkflowEngineService _engine;
    public WorkflowTemplatesController(ILimsDbContext db, IWorkflowEngineService engine)
    { _db = db; _engine = engine; }

    // GET api/v1/workflow-templates
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var templates = await _db.WorkflowTemplates
            .Include(t => t.Steps.OrderBy(s => s.StepOrder))
            .Include(t => t.Material)
            .Include(t => t.SampleType)
            .OrderBy(t => t.Name)
            .ToListAsync(ct);

        return Ok(templates.Select(t => new {
            t.WorkflowTemplateId, t.Name, t.Description,
            t.MaterialId, materialName = t.Material?.MaterialName,
            t.SampleTypeId, sampleTypeName = t.SampleType?.TypeName,
            t.IsDefault, t.IsActive,
            t.CreatedBy, t.CreatedAt, t.UpdatedBy, t.UpdatedAt,
            stepCount = t.Steps.Count,
            steps = t.Steps.OrderBy(s => s.StepOrder).Select(s => new {
                s.WorkflowStepId, s.StepOrder, s.StepName,
                s.RequiredRole, s.RequiresESignature,
                s.MinTestsRequired, s.GateCondition, s.IsOptional, s.Notes
            }),
        }));
    }

    // GET api/v1/workflow-templates/{id}
    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        var t = await _db.WorkflowTemplates
            .Include(x => x.Steps.OrderBy(s => s.StepOrder))
            .Include(x => x.Material).Include(x => x.SampleType)
            .FirstOrDefaultAsync(x => x.WorkflowTemplateId == id, ct);
        if (t is null) return NotFound();
        return Ok(t);
    }

    // GET api/v1/workflow-templates/for-sample/{sampleId}
    [HttpGet("for-sample/{sampleId}")]
    public async Task<IActionResult> GetForSample(int sampleId, CancellationToken ct)
    {
        var steps = await _engine.GetStepsAsync(sampleId, ct);
        var gateResults = new List<object>();
        foreach (var step in steps.Where(s => s.GateCondition != null))
        {
            var result = await _engine.CheckGatesAsync(sampleId, step.GateCondition!, ct);
            gateResults.Add(new { step.WorkflowStepId, step.StepName, step.GateCondition, result.Passed, result.Message });
        }
        return Ok(new { steps, gateResults });
    }

    // POST api/v1/workflow-templates
    [HttpPost]
    [Authorize(Roles = "Admin,QA,LabManager")]
    public async Task<IActionResult> Create([FromBody] CreateWorkflowTemplateRequest req, CancellationToken ct)
    {
        var template = new WorkflowTemplate
        {
            Name         = req.Name,
            Description  = req.Description,
            MaterialId   = req.MaterialId,
            SampleTypeId = req.SampleTypeId,
            IsDefault    = req.IsDefault,
            IsActive     = true,
            CreatedBy    = User.Identity?.Name ?? "unknown",
            CreatedAt    = DateTimeOffset.UtcNow,
        };
        _db.WorkflowTemplates.Add(template);
        await _db.SaveChangesAsync(ct);
        return Ok(new { template.WorkflowTemplateId });
    }

    // PUT api/v1/workflow-templates/{id}
    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,QA,LabManager")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateWorkflowTemplateRequest req, CancellationToken ct)
    {
        var t = await _db.WorkflowTemplates.FindAsync([id], ct);
        if (t is null) return NotFound();
        t.Name        = req.Name;
        t.Description = req.Description;
        t.MaterialId  = req.MaterialId;
        t.SampleTypeId = req.SampleTypeId;
        t.IsDefault   = req.IsDefault;
        t.IsActive    = req.IsActive;
        t.UpdatedBy   = User.Identity?.Name ?? "unknown";
        t.UpdatedAt   = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok();
    }

    // DELETE api/v1/workflow-templates/{id}
    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var t = await _db.WorkflowTemplates.FindAsync([id], ct);
        if (t is null) return NotFound();
        _db.WorkflowTemplates.Remove(t);
        await _db.SaveChangesAsync(ct);
        return Ok();
    }

    // POST api/v1/workflow-templates/{id}/steps
    [HttpPost("{id}/steps")]
    [Authorize(Roles = "Admin,QA,LabManager")]
    public async Task<IActionResult> AddStep(int id, [FromBody] WorkflowStepRequest req, CancellationToken ct)
    {
        var t = await _db.WorkflowTemplates.FindAsync([id], ct);
        if (t is null) return NotFound();
        var step = new WorkflowStep
        {
            WorkflowTemplateId  = id,
            StepOrder           = req.StepOrder,
            StepName            = req.StepName,
            RequiredRole        = req.RequiredRole,
            RequiresESignature  = req.RequiresESignature,
            MinTestsRequired    = req.MinTestsRequired,
            GateCondition       = req.GateCondition,
            IsOptional          = req.IsOptional,
            Notes               = req.Notes,
        };
        _db.WorkflowSteps.Add(step);
        await _db.SaveChangesAsync(ct);
        return Ok(new { step.WorkflowStepId });
    }

    // PUT api/v1/workflow-templates/{id}/steps/{stepId}
    [HttpPut("{id}/steps/{stepId}")]
    [Authorize(Roles = "Admin,QA,LabManager")]
    public async Task<IActionResult> UpdateStep(int id, int stepId, [FromBody] WorkflowStepRequest req, CancellationToken ct)
    {
        var step = await _db.WorkflowSteps
            .FirstOrDefaultAsync(s => s.WorkflowStepId == stepId && s.WorkflowTemplateId == id, ct);
        if (step is null) return NotFound();
        step.StepOrder          = req.StepOrder;
        step.StepName           = req.StepName;
        step.RequiredRole       = req.RequiredRole;
        step.RequiresESignature = req.RequiresESignature;
        step.MinTestsRequired   = req.MinTestsRequired;
        step.GateCondition      = req.GateCondition;
        step.IsOptional         = req.IsOptional;
        step.Notes              = req.Notes;
        await _db.SaveChangesAsync(ct);
        return Ok();
    }

    // DELETE api/v1/workflow-templates/{id}/steps/{stepId}
    [HttpDelete("{id}/steps/{stepId}")]
    [Authorize(Roles = "Admin,QA,LabManager")]
    public async Task<IActionResult> DeleteStep(int id, int stepId, CancellationToken ct)
    {
        var step = await _db.WorkflowSteps
            .FirstOrDefaultAsync(s => s.WorkflowStepId == stepId && s.WorkflowTemplateId == id, ct);
        if (step is null) return NotFound();
        _db.WorkflowSteps.Remove(step);
        await _db.SaveChangesAsync(ct);
        return Ok();
    }
}

public record CreateWorkflowTemplateRequest(string Name, string? Description, int? MaterialId, int? SampleTypeId, bool IsDefault);
public record UpdateWorkflowTemplateRequest(string Name, string? Description, int? MaterialId, int? SampleTypeId, bool IsDefault, bool IsActive);
public record WorkflowStepRequest(int StepOrder, string StepName, string RequiredRole, bool RequiresESignature, int? MinTestsRequired, string? GateCondition, bool IsOptional, string? Notes);
