namespace LIMS.Application.Interfaces;

// Contract 1: Single named service for ALL OOC flagging
// FR-05: cal-OOC impact; FR-16: breakdown-OOC impact — SAME service, two trigger modes
// No other code should flag logbook rows as OOC-affected

public record OOCImpactResult(int InstrumentId, string TriggerType, int AffectedEntryCount, IReadOnlyList<int> AffectedEntryIds);

public interface IOOCImpactService
{
    /// <summary>
    /// Cal-OOC trigger (FR-05): called by CalibrationDueDateJob when cal_due < today.
    /// Flags all logbook rows for this instrument created after the last approved calibration.
    /// </summary>
    Task<OOCImpactResult> FlagCalOOCAsync(int instrumentId, CancellationToken ct = default);

    /// <summary>
    /// Breakdown-OOC trigger (FR-16): called by BreakdownRepairService on return-to-service.
    /// Flags all logbook rows using this instrument during the breakdown window [raised_at, resolved_at].
    /// </summary>
    Task<OOCImpactResult> FlagBreakdownOOCAsync(int breakdownId, CancellationToken ct = default);
}
