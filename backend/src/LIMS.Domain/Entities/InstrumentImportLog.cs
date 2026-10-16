namespace LIMS.Domain.Entities;

public class InstrumentImportLog
{
    public int ImportLogId { get; set; }
    public int ExecutionId { get; set; }
    public TestExecution Execution { get; set; } = null!;
    public string FileName { get; set; } = string.Empty;
    public int TotalRows { get; set; }
    public int MatchedRows { get; set; }
    public int SkippedRows { get; set; }
    public int ImportedByUserId { get; set; }
    public User ImportedByUser { get; set; } = null!;
    public DateTimeOffset ImportedAt { get; set; } = DateTimeOffset.UtcNow;
}
