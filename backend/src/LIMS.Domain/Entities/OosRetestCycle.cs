namespace LIMS.Domain.Entities;

public class OosRetestCycle
{
    public int CycleId { get; set; }
    public int InvestigationId { get; set; }
    public OosInvestigation Investigation { get; set; } = null!;
    public int CycleNumber { get; set; }
    public int ExecutionId { get; set; }
    public TestExecution Execution { get; set; } = null!;
    public string? Notes { get; set; }
    public string CreatedBy { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
