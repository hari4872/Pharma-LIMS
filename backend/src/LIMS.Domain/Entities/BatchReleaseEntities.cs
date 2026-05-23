using LIMS.Domain.Enums;

namespace LIMS.Domain.Entities;

// ─────────────────────────────────────────────────────────────────────────────
// Sprint 7 — Batch Release Workflow
// ─────────────────────────────────────────────────────────────────────────────

/// <summary>
/// Batch release decision record.
/// QA reviews all tests, CoAs, and open investigations before making a Pass/Fail/Hold decision.
/// 21 CFR 211.192 — QA must review and approve each batch before release.
/// </summary>
public class BatchRelease
{
    public int BatchReleaseId { get; set; }

    public int SampleId { get; set; }
    public Sample Sample { get; set; } = null!;

    public BatchReleaseStatus Status { get; set; } = BatchReleaseStatus.PendingReview;

    /// <summary>QA decision: Released | Rejected | OnHold</summary>
    public string? Decision { get; set; }

    /// <summary>Mandatory justification for the decision</summary>
    public string? DecisionReason { get; set; }

    /// <summary>§11.50 e-signature on final release/reject decision</summary>
    public int? SignatureId { get; set; }
    public ElectronicSignature? Signature { get; set; }

    /// <summary>Checklist snapshot — JSON array of checkpoints verified before decision</summary>
    public string? ChecklistJson { get; set; }

    public int InitiatedByUserId { get; set; }
    public User InitiatedBy { get; set; } = null!;

    public int? ReviewedByUserId { get; set; }
    public User? ReviewedBy { get; set; }

    public DateTimeOffset InitiatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? DecidedAt { get; set; }

    public string CreatedBy { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public enum BatchReleaseStatus { PendingReview, InReview, Released, Rejected, OnHold }

/// <summary>
/// Checklist item evaluated at batch release time.
/// Immutable once the release decision is made (ALCOA+ Enduring).
/// </summary>
public class BatchReleaseCheckItem
{
    public int CheckItemId { get; set; }
    public int BatchReleaseId { get; set; }
    public BatchRelease BatchRelease { get; set; } = null!;

    public string CheckType { get; set; } = string.Empty;  // AllTestsComplete | CoAApproved | NoOpenOOS | NoOpenCapa | SpecCompliant
    public bool Passed { get; set; }
    public string Detail { get; set; } = string.Empty;
    public DateTimeOffset EvaluatedAt { get; set; } = DateTimeOffset.UtcNow;
}
