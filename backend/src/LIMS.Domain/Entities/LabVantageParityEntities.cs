using LIMS.Domain.Enums;

namespace LIMS.Domain.Entities;

// ─────────────────────────────────────────────────────────────────────────────
// 21 CFR §11.10(d) — System access controls: failed-login audit log
// INSERT-only: never update, never delete. Every login attempt recorded.
// ─────────────────────────────────────────────────────────────────────────────
public class LoginAuditLog
{
    public long LoginAuditLogId { get; set; }
    public string Username { get; set; } = default!;        // attempted username (may not map to a user)
    public int? UserId { get; set; }                        // null if username not found
    public User? User { get; set; }
    public string IpAddress { get; set; } = default!;
    public string? UserAgent { get; set; }
    public LoginOutcome Outcome { get; set; }
    public DateTimeOffset AttemptedAt { get; set; } = DateTimeOffset.UtcNow;
}

// ─────────────────────────────────────────────────────────────────────────────
// ICH Q1A — Stability Trending
// One row per parameter per time-point pull — feeds regression / shelf-life calc
// ─────────────────────────────────────────────────────────────────────────────
public class StabilityTrendPoint
{
    public int StabilityTrendPointId { get; set; }
    public int ProtocolId { get; set; }
    public StabilityProtocol Protocol { get; set; } = null!;
    public int ParameterId { get; set; }
    public TestMethodParameter Parameter { get; set; } = null!;
    public StabilityStorageCondition StorageCondition { get; set; }
    public int TimePointMonths { get; set; }                // 0, 3, 6, 12, 24 …
    public decimal MeasuredValue { get; set; }
    public int PullId { get; set; }
    public StabilityPull Pull { get; set; } = null!;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

// ─────────────────────────────────────────────────────────────────────────────
// LabVantage Parity — Sample Container / Aliquot management
// One sample login → N containers. Each container tested independently.
// ─────────────────────────────────────────────────────────────────────────────
public class SampleContainer
{
    public int SampleContainerId { get; set; }
    public int SampleId { get; set; }
    public Sample Sample { get; set; } = null!;

    /// <summary>For sub-aliquots: points to the parent container.</summary>
    public int? ParentSampleContainerId { get; set; }
    public SampleContainer? ParentContainer { get; set; }

    public string ContainerLabel { get; set; } = default!;  // barcode label
    public ContainerType ContainerType { get; set; } = ContainerType.Primary;
    public decimal? Volume { get; set; }
    public string? VolumeUom { get; set; }                  // mL, g, units …
    public int? StorageLocationId { get; set; }
    public StorageLocation? StorageLocation { get; set; }
    public ContainerStatus Status { get; set; } = ContainerStatus.Available;

    public string CreatedBy { get; set; } = default!;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? DestroyedAt { get; set; }
    public string? DestroyedBy { get; set; }
    public int? DestructionSignatureId { get; set; }
    public ElectronicSignature? DestructionSignature { get; set; }

    public ICollection<SampleContainer> ChildContainers { get; set; } = [];
}
