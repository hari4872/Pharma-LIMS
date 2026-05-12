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
        // Select the most recently approved form template for this lab
        // that is not dispatch-event-triggered (those are for outgoing QC only)
        var template = await _db.FormTemplates
            .Where(f => f.LabId == labId
                && f.IsActive
                && f.Status == FormTemplateStatus.Active
                && f.TriggerType != TriggerType.DispatchEvent)
            .OrderByDescending(f => f.FormTemplateId)
            .FirstOrDefaultAsync(ct);

        return template?.FormTemplateId;
    }
}
