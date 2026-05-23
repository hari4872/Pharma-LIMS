using LIMS.Domain.Enums;

namespace LIMS.Application.Interfaces;

// ─────────────────────────────────────────────────────────────────────────────
// ISpecificationEngineService — Phase A
//
// Matches a sample (Material + SampleType + Stage) to an Approved
// SpecificationTemplate and returns the match result so the caller can
// decide how to proceed (auto-assign, force-pick, warn, or block).
// ─────────────────────────────────────────────────────────────────────────────

public interface ISpecificationEngineService
{
    /// <summary>
    /// Finds the best specification template for the given sample attributes.
    /// Returns a SpecMatchResult describing the outcome and what to do next.
    /// </summary>
    Task<SpecMatchResult> MatchAsync(
        int materialId,
        int sampleTypeId,
        SpecStage stage,
        CancellationToken ct = default);

    /// <summary>
    /// Auto-creates one TestExecution per SpecTemplateItem for the given sample.
    /// Called after a template match is confirmed (auto or manual selection).
    /// Returns the list of created execution IDs.
    /// </summary>
    Task<List<int>> ApplyTemplateAsync(
        int sampleId,
        int specTemplateId,
        string assignedBy,           // 'System' for AutoMatch, username for ManualOverride
        SpecAssignmentReason reason,
        DateTimeOffset receivedAt,
        CancellationToken ct = default);
}

// ─────────────────────────────────────────────────────────────────────────────
// SpecMatchResult — outcome of a spec engine lookup
// ─────────────────────────────────────────────────────────────────────────────

public enum SpecMatchOutcome
{
    SingleMatch,        // Exactly one Approved template — auto-assign silently
    MultipleMatches,    // >1 Approved templates — user must pick
    NoMatch,            // No template found — allow manual or block
    DraftOnly,          // Template exists but not Approved yet — block
    ObsoleteOnly,       // Template exists but Obsolete — block with message
}

public record SpecMatchResult(
    SpecMatchOutcome Outcome,
    int? TemplateId,                                // set for SingleMatch
    List<SpecTemplateSummary> Candidates,           // set for MultipleMatches
    string Message                                  // human-readable for UI banner / warning
);

public record SpecTemplateSummary(
    int TemplateId,
    string TemplateName,
    string Version,
    DateTimeOffset? ApprovedAt,
    int TestCount
);
