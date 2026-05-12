namespace LIMS.Application.Interfaces;

// Contract 1: Single named service for excursion impact assessment
// FR-13: flags all samples in location during excursion window
// QA notified via SignalR (Contract 2)

public record ExcursionImpactResult(int ExcursionId, int AffectedSampleCount, IReadOnlyList<int> AffectedSampleIds);

public interface IExcursionImpactService
{
    /// <summary>
    /// Determines which samples were located at the given storage location
    /// during the excursion window [excursionStart, excursionEnd].
    /// Inserts ExcursionAffectedSample records and notifies QA via SignalR.
    /// </summary>
    Task<ExcursionImpactResult> AssessImpactAsync(int excursionId, CancellationToken ct = default);
}
