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

    // OOS Retest (Phase 1 retest) — RetestExecutionId kept for backward compat, points to latest cycle
    public int? RetestExecutionId { get; set; }
    public TestExecution? RetestExecution { get; set; }
    public List<OosRetestCycle> RetestCycles { get; set; } = new();
    public OosResolutionType? ResolutionType { get; set; }  // set on close: LabError | GenuineOOS | ConditionalRelease
    public string? ConditionalReleaseNote { get; set; }     // required when ResolutionType = ConditionalRelease

    // Group C — Genuine OOS rework path
    public int? ReworkExecutionId { get; set; }
    public TestExecution? ReworkExecution { get; set; }
    public int? PostReworkRetestExecutionId { get; set; }
    public TestExecution? PostReworkRetestExecution { get; set; }
    public OosFinalDecision? FinalDecision { get; set; }
    public DateTimeOffset? FinalDecisionAt { get; set; }
    public string? FinalDecisionBy { get; set; }

}
