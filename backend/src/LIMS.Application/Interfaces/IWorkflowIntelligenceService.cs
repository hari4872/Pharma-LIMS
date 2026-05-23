namespace LIMS.Application.Interfaces;

public interface IWorkflowIntelligenceService
{
    /// <summary>
    /// Risk-based priority score for a test execution.
    /// Score = f(sample urgency, material criticality, TAT remaining, analyst queue depth).
    /// Lower score = higher priority (1 = most urgent).
    /// </summary>
    Task<int> CalculatePriorityScoreAsync(int executionId, CancellationToken ct = default);

    /// <summary>
    /// Returns the analyst (userId) with lowest active queue depth in the given lab.
    /// Used to auto-assign new test executions in a balanced way.
    /// </summary>
    Task<WorkloadSuggestion?> SuggestAnalystAsync(int labId, CancellationToken ct = default);

    /// <summary>
    /// Predicted TAT in hours for a new execution (rolling 30-day average for the parameter).
    /// </summary>
    Task<double?> PredictTatAsync(int parameterId, int labId, CancellationToken ct = default);

    /// <summary>
    /// Returns the full queue intelligence summary for a lab.
    /// </summary>
    Task<QueueIntelligence> GetQueueIntelligenceAsync(int labId, CancellationToken ct = default);
}

public record WorkloadSuggestion(int UserId, string FullName, int ActiveCount, string Reason);

public record QueueIntelligence(
    int LabId,
    int TotalOpen,
    int Overdue,
    int OosOpen,
    AnalystLoad[] AnalystLoads,
    PriorityBand[] PriorityBands,
    double? AvgTatHours);

public record AnalystLoad(int UserId, string FullName, int Assigned, int InProgress, int Overdue);
public record PriorityBand(string Band, int Count);  // Critical / High / Medium / Low
