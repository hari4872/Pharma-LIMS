using LIMS.Domain.Enums;

namespace LIMS.Domain.Entities;

public class SpecLimit
{
    public int SpecLimitId { get; set; }
    public int ParameterId { get; set; }
    public TestMethodParameter Parameter { get; set; } = default!;
    public int? MaterialId { get; set; }
    public Material? Material { get; set; }
    public SpecStage Stage { get; set; }
    public decimal? MinValue { get; set; }
    public decimal? MaxValue { get; set; }
    public RegulatoryTier? RegulatoryTier { get; set; }
    public decimal? RegulatoryMin { get; set; }
    public decimal? RegulatoryMax { get; set; }
    public decimal? OotMinValue { get; set; }              // OOT threshold — Phase 1a v1.1
    public decimal? OotMaxValue { get; set; }
    public ApprovalStatus Status { get; set; } = ApprovalStatus.Draft;
    public string Version { get; set; } = "1.0";
    public string? ApprovedBy { get; set; }
    public DateTimeOffset? ApprovedAt { get; set; }
    public int? SignatureId { get; set; }
    public ElectronicSignature? Signature { get; set; }
    public bool IsActive { get; set; } = true;
    public string CreatedBy { get; set; } = default!;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
