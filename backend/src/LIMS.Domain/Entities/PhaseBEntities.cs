using LIMS.Domain.Enums;

namespace LIMS.Domain.Entities;

// ─────────────────────────────────────────────────────────────────────────────
// Phase B — Sampling Plans & Stability Protocols
// ─────────────────────────────────────────────────────────────────────────────

/// <summary>
/// Defines how and when samples are collected for a given Material + SampleType.
/// Drives automated sample scheduling in the SamplingSchedulerService.
/// </summary>
public class SamplingPlan
{
    public int SamplingPlanId { get; set; }

    /// <summary>Human-readable name, e.g. "FP Routine Incoming — Weekly"</summary>
    public string PlanName { get; set; } = default!;

    public int MaterialId { get; set; }
    public Material Material { get; set; } = default!;

    public int SampleTypeId { get; set; }
    public SampleType SampleType { get; set; } = default!;

    /// <summary>Spec stage this plan targets</summary>
    public SpecStage Stage { get; set; }

    /// <summary>How often samples are collected</summary>
    public FrequencyType Frequency { get; set; }

    /// <summary>
    /// For TimeBased frequencies: interval in hours between samples.
    /// Null for Batch/Event/Stability frequencies.
    /// </summary>
    public int? IntervalHours { get; set; }

    /// <summary>Number of sample units collected per pull</summary>
    public int SamplesPerPull { get; set; } = 1;

    /// <summary>Optional — linked to a SpecificationTemplate for auto-testing</summary>
    public int? SpecTemplateId { get; set; }
    public SpecificationTemplate? SpecTemplate { get; set; }

    /// <summary>Optional description / SOPs reference</summary>
    public string? Notes { get; set; }

    public bool IsActive { get; set; } = true;

    // Audit
    public string CreatedBy { get; set; } = default!;
    public DateTimeOffset CreatedAt { get; set; }
    public string? UpdatedBy { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }
}

/// <summary>
/// Stability protocol master record. Defines the study design for a material.
/// Each protocol has one or more intervals (T=0, T=3M, T=6M, etc.)
/// </summary>
public class StabilityProtocol
{
    public int StabilityProtocolId { get; set; }

    public string ProtocolName { get; set; } = default!;

    public int MaterialId { get; set; }
    public Material Material { get; set; } = default!;

    /// <summary>Regulatory standard driving the protocol (USP, ICH Q1A, etc.)</summary>
    public string? RegulatoryBasis { get; set; }

    /// <summary>Total study duration in months</summary>
    public int StudyDurationMonths { get; set; }

    public StabilityStorageCondition StorageCondition { get; set; }

    /// <summary>Target temperature for the stability chamber (°C)</summary>
    public decimal? TargetTempC { get; set; }

    /// <summary>Target relative humidity (%)</summary>
    public decimal? TargetRhPct { get; set; }

    /// <summary>Optional link to the SpecificationTemplate used for stability testing</summary>
    public int? SpecTemplateId { get; set; }
    public SpecificationTemplate? SpecTemplate { get; set; }

    public string? Description { get; set; }

    /// <summary>Intended shelf life in months — used for ICH compliance calculations</summary>
    public int? IntendedShelfLifeMonths { get; set; }

    public bool IsActive { get; set; } = true;

    // Audit
    public string CreatedBy { get; set; } = default!;
    public DateTimeOffset CreatedAt { get; set; }
    public string? UpdatedBy { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }

    // Navigation
    public ICollection<StabilityInterval> Intervals { get; set; } = new List<StabilityInterval>();
}

/// <summary>
/// One time-point within a StabilityProtocol, e.g. T=0, T=3M, T=6M, T=12M.
/// When a stability pull is created, it references one of these intervals.
/// </summary>
public class StabilityInterval
{
    public int StabilityIntervalId { get; set; }

    public int StabilityProtocolId { get; set; }
    public StabilityProtocol Protocol { get; set; } = default!;

    /// <summary>Offset in months from batch manufacture date, e.g. 0, 3, 6, 12, 24</summary>
    public int MonthOffset { get; set; }

    /// <summary>Human-readable label, e.g. "T=0", "3-Month", "6-Month"</summary>
    public string Label { get; set; } = default!;

    /// <summary>Number of sample units required at this pull</summary>
    public int SampleUnitsRequired { get; set; } = 1;

    /// <summary>Optional tolerance window in days (pull can happen +/- tolerance days)</summary>
    public int? ToleranceDays { get; set; }

    /// <summary>Whether this time-point is mandatory per the regulatory requirement</summary>
    public bool IsMandatory { get; set; } = true;
}
