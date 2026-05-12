namespace LIMS.Domain.Entities;

// ── Phase 6 — Instrument Management v1.2 ──────────────────────

// FR-15: Instrument utilisation summary — computed by UtilisationSummaryJob (Contract 2)
// Window (7/30/90 days) from DB config — not hardcoded
public class InstrumentUtilisationSummary
{
    public int SummaryId { get; set; }
    public int InstrumentId { get; set; }
    public Instrument Instrument { get; set; } = null!;
    public int WindowDays { get; set; }                         // 7 | 30 | 90 — from DB config (Contract 2)
    public DateTimeOffset WindowStart { get; set; }
    public DateTimeOffset WindowEnd { get; set; }
    public int TotalTests { get; set; } = 0;
    public decimal TotalHours { get; set; } = 0;
    public decimal? UtilisationPct { get; set; }                // server-computed (Contract 2)
    public DateTimeOffset CalculatedAt { get; set; } = DateTimeOffset.UtcNow;
}

// ── Phase 7 — Dashboards ──────────────────────────────────────

// TAT breach log — INSERT-only, server-side detection (TATBreachJob — Contract 2)
public class TatBreachLog
{
    public long BreachId { get; set; }
    public int SampleId { get; set; }
    public Sample Sample { get; set; } = null!;
    public decimal TargetHours { get; set; }                    // from lab_config — not hardcoded
    public decimal ActualHours { get; set; }
    public decimal BreachHours { get; set; }                    // server-computed = ActualHours - TargetHours
    public DateTimeOffset DetectedAt { get; set; } = DateTimeOffset.UtcNow;
    public bool NotifiedViaSignalR { get; set; } = false;
}

// ── Phase 8 — Compliance & Governance ────────────────────────

// EU Annex 11 §12.4 — Periodic re-validation log
// INSERT-only: IPeriodicReviewService is the single writer (Contract 1)
public class ValidationReviewLog
{
    public int ReviewId { get; set; }
    public string ReviewType { get; set; } = string.Empty;      // Annual | Triggered | PostChange
    public string ReviewedBy { get; set; } = string.Empty;
    public DateTimeOffset ReviewedAt { get; set; } = DateTimeOffset.UtcNow;
    public string Outcome { get; set; } = string.Empty;         // Passed | FailedWithActions | Deferred
    public string? Notes { get; set; }
    public int? SignatureId { get; set; }
    public ElectronicSignature? Signature { get; set; }
    public DateTimeOffset NextReviewDue { get; set; }           // server-calculated from DB config
}
