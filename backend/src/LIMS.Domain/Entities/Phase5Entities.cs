using LIMS.Domain.Enums;

namespace LIMS.Domain.Entities;

// ──────────────────────────────────────────────────────────────
// Phase 5 — Traceability (TD_06)
// ──────────────────────────────────────────────────────────────

// FR-09: Sampling event — upstream traceability node (v1.2)
// ALCOA+ Attributable: who sampled, when, where, quantity
public class SamplingEvent
{
    public int SamplingEventId { get; set; }
    public int SampleId { get; set; }
    public Sample Sample { get; set; } = null!;
    public int SampledById { get; set; }
    public User SampledBy { get; set; } = null!;
    public DateTimeOffset SampledAt { get; set; } = DateTimeOffset.UtcNow;   // UTC server-side (Contract 2)
    public string? Location { get; set; }
    public decimal? QuantityTaken { get; set; }
    public string? QuantityUom { get; set; }
    public string? ContainerId { get; set; }
    public string? Notes { get; set; }
}

// FR-08: Complaint/Deviation/CAPA — downstream quality event (v1.2 + Sprint 1 enhanced)
// FK-only references — no denormalised copies (Contract 1)
public class ComplaintsDeviation
{
    public int CdId { get; set; }
    public int? SampleId { get; set; }                               // Optional — CAPA may not tie to a sample
    public Sample? Sample { get; set; }
    public CdType CdType { get; set; }                               // Complaint | Deviation | Capa
    public string CdReference { get; set; } = string.Empty;         // UNIQUE reference number
    public string Title { get; set; } = string.Empty;               // Sprint 1: short title for listing
    public string? Description { get; set; }
    public string Status { get; set; } = "Open";                    // Open | UnderReview | Closed | Verified
    public string Priority { get; set; } = "Medium";                // Low | Medium | High | Critical
    public string? RootCause { get; set; }
    public string? CorrectiveAction { get; set; }
    public string? PreventiveAction { get; set; }
    public int? AssignedToUserId { get; set; }
    public User? AssignedTo { get; set; }
    public DateOnly? DueDate { get; set; }
    public int? LabId { get; set; }
    public Laboratory? Lab { get; set; }
    public string OpenedBy { get; set; } = string.Empty;
    public DateTimeOffset OpenedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? ResolvedAt { get; set; }
    public string? ResolvedBy { get; set; }
    public string? UpdatedBy { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }
    public int? LinkedOosId { get; set; }
    public OosInvestigation? LinkedOos { get; set; }
    public string? CAPARef { get; set; }
}

// FR-07: Trace query log — INSERT-only (21 CFR §11.10(e))
// Captures who queried the traceability graph, when, and with what filters
public class TraceQueryLog
{
    public long LogId { get; set; }
    public int QueriedById { get; set; }
    public User QueriedBy { get; set; } = null!;
    public DateTimeOffset QueriedAt { get; set; } = DateTimeOffset.UtcNow;
    public string FilterParams { get; set; } = string.Empty;        // JSONB — batch, lot, date, analyst, instrument
    public int? ResultCount { get; set; }
}

// ──────────────────────────────────────────────────────────────
// Phase 5 — Sample Inventory & Pull Planning (TD_07)
// ──────────────────────────────────────────────────────────────

// FR-10: Storage location master — room/chamber/shelf hierarchy
// Condition limits from DB — not hardcoded (Contract 2)
public class StorageLocation
{
    public int LocationId { get; set; }
    public int LabId { get; set; }
    public Laboratory Lab { get; set; } = null!;
    public string LocationCode { get; set; } = string.Empty;        // UNIQUE
    public string LocationName { get; set; } = string.Empty;
    public LocationType LocationType { get; set; }                  // Ambient|Cold|Freezer|StabilityChamber
    public decimal? TempMinC { get; set; }                          // from DB — not hardcoded (Contract 2)
    public decimal? TempMaxC { get; set; }
    public decimal? HumidityMinPct { get; set; }
    public decimal? HumidityMaxPct { get; set; }
    public int? LowStockThreshold { get; set; }                     // configurable alert threshold
    public bool IsActive { get; set; } = true;

    public ICollection<StorageTransferLog> TransfersIn { get; set; } = [];
    public ICollection<StorageTransferLog> TransfersOut { get; set; } = [];
    public ICollection<ConditionExcursion> ConditionExcursions { get; set; } = [];
    public ICollection<RetainSample> RetainSamples { get; set; } = [];
}

// FR-12: INSERT-only location transfer log — chain of custody (21 CFR 211.170)
public class StorageTransferLog
{
    public int TransferId { get; set; }
    public int SampleId { get; set; }
    public Sample Sample { get; set; } = null!;
    public int FromLocationId { get; set; }
    public StorageLocation FromLocation { get; set; } = null!;
    public int ToLocationId { get; set; }
    public StorageLocation ToLocation { get; set; } = null!;
    public string TransferredBy { get; set; } = string.Empty;
    public DateTimeOffset TransferredAt { get; set; } = DateTimeOffset.UtcNow;   // UTC server-side
    public string? Reason { get; set; }
}

// FR-13: Condition excursion — temp/humidity/light excursion logging
// ExcursionImpactService (Contract 1) flags all samples in location during window
public class ConditionExcursion
{
    public int ExcursionId { get; set; }
    public int LocationId { get; set; }
    public StorageLocation Location { get; set; } = null!;
    public ExcursionType ExcursionType { get; set; }                // Temperature | Humidity | Light
    public decimal MeasuredValue { get; set; }
    public string LimitExceeded { get; set; } = string.Empty;      // Min | Max
    public DateTimeOffset ExcursionStart { get; set; }
    public DateTimeOffset? ExcursionEnd { get; set; }
    public string RecordedBy { get; set; } = string.Empty;
    public DateTimeOffset RecordedAt { get; set; } = DateTimeOffset.UtcNow;
    public bool ImpactAssessed { get; set; } = false;
    public string? ImpactOutcome { get; set; }

    public ICollection<ExcursionAffectedSample> AffectedSamples { get; set; } = [];
}

// Link table: which samples were in a location during an excursion window
public class ExcursionAffectedSample
{
    public int Id { get; set; }
    public int ExcursionId { get; set; }
    public ConditionExcursion Excursion { get; set; } = null!;
    public int SampleId { get; set; }
    public Sample Sample { get; set; } = null!;
    public DateTimeOffset FlaggedAt { get; set; } = DateTimeOffset.UtcNow;
    public string FlaggedBy { get; set; } = string.Empty;          // ExcursionImpactService
}

// FR-01/FR-02: Stability pull — ICH Q1A time-point scheduling
// Pull due dates server-side from T0 + time-points from DB (Contract 2 — no hardcoding)
public class StabilityPull
{
    public int PullId { get; set; }
    public int SampleId { get; set; }
    public Sample Sample { get; set; } = null!;
    public string TimePoint { get; set; } = string.Empty;          // e.g. T0, T3M, T6M, T12M
    public DateOnly DueDate { get; set; }                          // server-calculated from T0 + time-point
    public decimal RequiredQty { get; set; }
    public string RequiredQtyUom { get; set; } = string.Empty;
    public string Status { get; set; } = "Pending";                // Pending | Pulled | Missed | Escalated
    public int? ExecutedById { get; set; }
    public User? ExecutedBy { get; set; }
    public DateTimeOffset? PulledAt { get; set; }
    public decimal? ActualQty { get; set; }
    public int? SignatureId { get; set; }
    public ElectronicSignature? Signature { get; set; }            // §11.50 pull e-sig
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<ShortPullDeviation> ShortPullDeviations { get; set; } = [];
}

// FR-15: Short pull deviation — auto-logged when actual < required (ALCOA+ Complete)
// Analyst cannot complete pull without logging reason
public class ShortPullDeviation
{
    public int DeviationId { get; set; }
    public int PullId { get; set; }
    public StabilityPull Pull { get; set; } = null!;
    public decimal RequiredQty { get; set; }
    public decimal ActualQty { get; set; }
    public decimal Shortfall { get; set; }                         // server-computed = RequiredQty - ActualQty
    public string Reason { get; set; } = string.Empty;            // mandatory before pull completes (FR-15)
    public string LoggedBy { get; set; } = string.Empty;
    public DateTimeOffset LoggedAt { get; set; } = DateTimeOffset.UtcNow;
}

// FR-08: Retain sample management (21 CFR 211.170)
// Retention period from DB config (Contract 2 — not hardcoded)
// Destruction: QA §11.50 e-sig + reason; INSERT-only record
public class RetainSample
{
    public int RetainId { get; set; }
    public int SampleId { get; set; }
    public Sample Sample { get; set; } = null!;
    public int LocationId { get; set; }
    public StorageLocation Location { get; set; } = null!;
    public string LotNumber { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public string QuantityUom { get; set; } = string.Empty;
    public DateOnly RetainedOn { get; set; }
    public DateOnly RetentionDueDate { get; set; }                 // T0 + retention_period_months from LabConfig
    public string Status { get; set; } = "Active";                // Active | Destroyed | Transferred
    public string RetainedBy { get; set; } = string.Empty;
    public DateTimeOffset? DestroyedAt { get; set; }
    public string? DestroyedBy { get; set; }
    public int? DestructionSignatureId { get; set; }
    public ElectronicSignature? DestructionSignature { get; set; } // QA §11.50 e-sig
    public string? DestructionReason { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
