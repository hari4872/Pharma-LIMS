using LIMS.Domain.Enums;

namespace LIMS.Domain.Entities;

public class OosInvestigation
{
    public int InvestigationId { get; set; }
    public int ExecutionId { get; set; }
    public TestExecution Execution { get; set; } = null!;
    public int EntryId { get; set; }
    public DigitalLogbookEntry Entry { get; set; } = null!;
    public int ParameterId { get; set; }
    public TestMethodParameter Parameter { get; set; } = null!;
    public OosFlag FlagType { get; set; } = OosFlag.OOS;
    public OosPhase Phase { get; set; } = OosPhase.Phase1;
    public OosStatus Status { get; set; } = OosStatus.Open;
    public string? RootCause { get; set; }
    public string? CapaRef { get; set; }
    public string? CapaStatus { get; set; }
    public int? SignatureId { get; set; }
    public ElectronicSignature? Signature { get; set; }
    public DateTimeOffset OpenedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? ClosedAt { get; set; }
    public string CreatedBy { get; set; } = string.Empty;
}
