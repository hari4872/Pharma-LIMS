using LIMS.Domain.Enums;

namespace LIMS.Domain.Entities;

public class ResultsReview
{
    public int ReviewId { get; set; }
    public int SampleId { get; set; }
    public Sample Sample { get; set; } = null!;
    public int ExecutionId { get; set; }
    public TestExecution Execution { get; set; } = null!;
    public ReviewType ReviewType { get; set; }
    public int ReviewerId { get; set; }
    public User Reviewer { get; set; } = null!;
    public int SignatureId { get; set; }
    public ElectronicSignature Signature { get; set; } = null!;
    public DateTimeOffset ReviewedAt { get; set; } = DateTimeOffset.UtcNow;
    public string? Notes { get; set; }
}
