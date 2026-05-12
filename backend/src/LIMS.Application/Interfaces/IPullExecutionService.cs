namespace LIMS.Application.Interfaces;

// Contract 1: Single named service for pull execution
// FR-06: Inventory deduction atomic in PullExecutionService
// FR-07: Pull triggers RegisterSampleCommand (Contract 1 — same command, no duplicate)
// FR-15: Short pull auto-logged when actual < required

public record PullExecutionResult(int PullId, bool HasShortfall, int? ShortPullDeviationId);

public interface IPullExecutionService
{
    /// <summary>
    /// Executes a stability pull:
    /// 1. Validates pull exists and is Pending.
    /// 2. Verifies §11.50 e-sig (BCrypt, Contract 2).
    /// 3. Auto-logs ShortPullDeviation if actualQty < requiredQty (FR-15).
    /// 4. Updates pull status to Pulled.
    /// All atomically in a single transaction (Contract 1).
    /// </summary>
    Task<PullExecutionResult> ExecuteAsync(
        int pullId, decimal actualQty, string reason,
        int analystId, string password, string meaning,
        CancellationToken ct = default);
}
