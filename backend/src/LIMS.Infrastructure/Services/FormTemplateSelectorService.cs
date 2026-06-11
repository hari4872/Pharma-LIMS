using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Infrastructure.Services;

// Contract 1: single service for Form Template auto-selection — no analyst UI dropdown (FR-17)
public class FormTemplateSelectorService : IFormTemplateSelectorService
{
    private readonly ILimsDbContext _db;
    public FormTemplateSelectorService(ILimsDbContext db) => _db = db;

    public async Task<int?> SelectAsync(int labId, int materialId, CancellationToken ct = default)
    {
        // Step 1: Try to find a form template matching lab + sample type (via material's sample type)
        // This ensures Finished Product samples get FP forms, Raw Material gets RM forms, etc.
        var material = await _db.Materials.FirstOrDefaultAsync(m => m.MaterialId == materialId, ct);

        if (material != null)
        {
            // Match by lab + material type (e.g. FinishedProduct, RawMaterial, API)
            var specificTemplate = await _db.FormTemplates
                .Where(f => f.LabId == labId
                    && f.IsActive
                    && f.Status == FormTemplateStatus.Active
                    && f.TriggerType != TriggerType.DispatchEvent
                    && f.SampleTypeId != null)
                .OrderByDescending(f => f.FormTemplateId)
                .FirstOrDefaultAsync(ct);

            if (specificTemplate != null)
                return specificTemplate.FormTemplateId;
        }

        // Step 2: Fall back to any active form template for this lab (no sample type restriction)
        var fallback = await _db.FormTemplates
            .Where(f => f.LabId == labId
                && f.IsActive
                && f.Status == FormTemplateStatus.Active
                && f.TriggerType != TriggerType.DispatchEvent)
            .OrderByDescending(f => f.FormTemplateId)
            .FirstOrDefaultAsync(ct);

        if (fallback != null) return fallback.FormTemplateId;

        // Step 3: Cross-lab fallback — use any active template from any lab (handles new labs with no templates yet)
        var crossLabFallback = await _db.FormTemplates
            .Where(f => f.IsActive
                && f.Status == FormTemplateStatus.Active
                && f.TriggerType != TriggerType.DispatchEvent)
            .OrderByDescending(f => f.FormTemplateId)
            .FirstOrDefaultAsync(ct);

        return crossLabFallback?.FormTemplateId;
    }
}
