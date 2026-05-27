using LIMS.Domain.Enums;

namespace LIMS.Domain.Entities;

public class DigitalLogbookEntry
{
    public int EntryId { get; set; }
    public int SampleId { get; set; }
    public Sample Sample { get; set; } = null!;
    public int ExecutionId { get; set; }
    public TestExecution Execution { get; set; } = null!;
    public int ParameterId { get; set; }
    public TestMethodParameter Parameter { get; set; } = null!;
    public TriggerType TriggerSource { get; set; } = TriggerType.OperatorScan;

    // Values — raw entry then server-computed result
    public string RawValue { get; set; } = string.Empty;
    public decimal? CalculatedResult { get; set; }
    public bool AutoCorrectionApplied { get; set; } = false;
    public string? CorrectionDetail { get; set; }

    // Spec snapshots captured at test time — ALCOA+ Enduring
    public decimal? SpecMinSnapshot { get; set; }
    public decimal? SpecMaxSnapshot { get; set; }
    public decimal? OotMinSnapshot { get; set; }
    public decimal? OotMaxSnapshot { get; set; }
    public string? RegulatoryTierSnapshot { get; set; }

    // OOS / OOT flags — server-set by OosDetectionService
    public string PassFail { get; set; } = "PASS";
    public bool IsOos { get; set; } = false;
    public bool IsOot { get; set; } = false;

    public int? InstrumentId { get; set; }
    public Instrument? Instrument { get; set; }
    public int AnalystId { get; set; }
    public User Analyst { get; set; } = null!;
    public int? SignatureId { get; set; }
    public ElectronicSignature? Signature { get; set; }

    // Evidence — mandatory for is_critical parameters before sign-off
    public string? EvidenceFileRef { get; set; }

    public LogbookEntryStatus Status { get; set; } = LogbookEntryStatus.Pending;
    public int? SupersededById { get; set; }
    public DigitalLogbookEntry? SupersededByEntry { get; set; }

    // Amendment trail (21 CFR §11.10(e) — original preserved, new entry links back)
    public string? AmendmentReason { get; set; }
    public int? AmendmentSignatureId { get; set; }
    public ElectronicSignature? AmendmentSignature { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<ResultEvidence> Evidences { get; set; } = [];
}
