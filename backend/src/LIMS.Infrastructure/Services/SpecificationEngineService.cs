using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Infrastructure.Services;

// ─────────────────────────────────────────────────────────────────────────────
// SpecificationEngineService — Phase A
//
// MatchAsync   — 3-key lookup (Material + SampleType + Stage) → SpecMatchResult
// ApplyTemplate — creates TestExecution rows from SpecTemplateItems
// ─────────────────────────────────────────────────────────────────────────────

public class SpecificationEngineService : ISpecificationEngineService
{
    private readonly ILimsDbContext _db;

    public SpecificationEngineService(ILimsDbContext db) => _db = db;

    // ── Match ─────────────────────────────────────────────────────────────────

    public async Task<SpecMatchResult> MatchAsync(
        int materialId, int sampleTypeId, SpecStage stage, CancellationToken ct = default)
    {
        var templates = await _db.SpecificationTemplates
            .Where(t => t.MaterialId == materialId
                     && t.SampleTypeId == sampleTypeId
                     && t.Stage == stage)
            .Include(t => t.Items)
            .OrderByDescending(t => t.ApprovedAt)
            .ToListAsync(ct);

        if (!templates.Any())
            return new SpecMatchResult(
                SpecMatchOutcome.NoMatch, null, [],
                "No specification template found for this Material / Sample Type / Stage combination. " +
                "You can register the sample and assign tests manually, or ask QA to create a specification template.");

        // Only Draft templates found
        if (templates.All(t => t.Status == SpecTemplateStatus.Draft))
            return new SpecMatchResult(
                SpecMatchOutcome.DraftOnly, null, [],
                $"A specification template exists ({templates.First().TemplateName}) but is still in Draft. " +
                "Contact QA to approve it before this sample type can be auto-assigned.");

        // Only Obsolete templates found
        if (templates.All(t => t.Status == SpecTemplateStatus.Obsolete))
            return new SpecMatchResult(
                SpecMatchOutcome.ObsoleteOnly, null, [],
                $"The specification template ({templates.First().TemplateName}) has been marked Obsolete. " +
                "Contact QA to create or approve a replacement.");

        // Filter to Approved only
        var approved = templates
            .Where(t => t.Status == SpecTemplateStatus.Approved)
            // Respect EffectiveFrom — don't apply a future-dated spec
            .Where(t => t.EffectiveFrom == null || t.EffectiveFrom <= DateTimeOffset.UtcNow)
            .ToList();

        if (approved.Count == 0)
            return new SpecMatchResult(
                SpecMatchOutcome.DraftOnly, null, [],
                "No Approved specification template is currently effective. Contact QA.");

        var summaries = approved.Select(t => new SpecTemplateSummary(
            t.SpecTemplateId, t.TemplateName, t.Version, t.ApprovedAt, t.Items.Count)).ToList();

        if (approved.Count == 1)
            return new SpecMatchResult(
                SpecMatchOutcome.SingleMatch,
                approved[0].SpecTemplateId,
                summaries,
                $"✓ Specification {approved[0].TemplateName} v{approved[0].Version} applied — {approved[0].Items.Count} test(s) auto-assigned.");

        // Multiple approved — let user pick
        return new SpecMatchResult(
            SpecMatchOutcome.MultipleMatches, null, summaries,
            "Multiple approved specifications found. Please select which one applies to this sample.");
    }

    // ── Apply ─────────────────────────────────────────────────────────────────

    public async Task<List<int>> ApplyTemplateAsync(
        int sampleId,
        int specTemplateId,
        string assignedBy,
        SpecAssignmentReason reason,
        DateTimeOffset receivedAt,
        CancellationToken ct = default)
    {
        var template = await _db.SpecificationTemplates
            .Include(t => t.Items)
            .FirstOrDefaultAsync(t => t.SpecTemplateId == specTemplateId, ct);

        if (template is null)
            throw new InvalidOperationException($"SpecificationTemplate {specTemplateId} not found.");

        // Stamp the sample with spec assignment audit fields
        var sample = await _db.Samples.FindAsync([sampleId], ct);
        if (sample is null)
            throw new InvalidOperationException($"Sample {sampleId} not found.");

        sample.SpecTemplateId        = specTemplateId;
        sample.SpecAssignedBy        = assignedBy;
        sample.SpecAssignedAt        = DateTimeOffset.UtcNow;
        sample.SpecAssignmentReason  = reason;

        // Calculate sample-level DueDate = receivedAt + max TAT across all items
        var maxTat = template.Items.Any() ? template.Items.Max(i => i.TurnaroundHours) : 24;
        sample.DueDate = receivedAt.AddHours(maxTat);
        sample.Status  = SampleStatus.PendingTesting;

        // Create one TestExecution per spec template item
        var executionIds = new List<int>();
        foreach (var item in template.Items.OrderBy(i => i.SortOrder))
        {
            var execution = new TestExecution
            {
                SampleId          = sampleId,
                SpecTemplateItemId = item.SpecTemplateItemId,
                ParameterId       = item.ParameterId,
                // Instrument and Analyst will be assigned by Lab Manager (Phase D auto-suggests)
                InstrumentId      = null,  // assigned at work queue
                AnalystId         = null,  // assigned at work queue
                Status            = TestExecutionStatus.Assigned,
                DueAt             = receivedAt.AddHours(item.TurnaroundHours),
                PriorityScore     = sample.IsRush ? 100 : item.SortOrder,
                CreatedBy         = assignedBy,
                CreatedAt         = DateTimeOffset.UtcNow,
            };
            _db.TestExecutions.Add(execution);
            executionIds.Add(execution.ExecutionId);
        }

        await _db.SaveChangesAsync(ct);

        return executionIds;
    }
}
