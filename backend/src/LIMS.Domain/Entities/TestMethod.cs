using LIMS.Domain.Enums;

namespace LIMS.Domain.Entities;

public class TestMethod
{
    public int MethodId { get; set; }
    public string MethodCode { get; set; } = default!;     // UNIQUE
    public string MethodName { get; set; } = default!;
    public string? SopReference { get; set; }
    public string? MethodType { get; set; }
    public ApprovalStatus Status { get; set; } = ApprovalStatus.Draft;
    public string Version { get; set; } = "1.0";
    public string? ApprovedBy { get; set; }
    public DateTimeOffset? ApprovedAt { get; set; }
    public int? SignatureId { get; set; }
    public ElectronicSignature? Signature { get; set; }
    public bool IsActive { get; set; } = true;
    public string CreatedBy { get; set; } = default!;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<TestMethodParameter> Parameters { get; set; } = [];
}
