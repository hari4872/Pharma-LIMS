namespace LIMS.Application.Interfaces;

// Contract 1: Single service owns ALL instrument status transitions
// Contract 2: In-Use status set/cleared server-side — React never sets this flag (FR-12)
// 4 states: Available | In-Use | Maintenance | OutOfCalibration
public interface IInstrumentStatusService
{
    /// <summary>
    /// Refreshes In-Use status for a given instrument based on active test executions.
    /// Called when a test starts or completes. React never sets this — server-side only (FR-12).
    /// </summary>
    Task RefreshInUseStatusAsync(int instrumentId, CancellationToken ct = default);

    /// <summary>
    /// Sets Maintenance status (PM opened or Breakdown opened — FR-13).
    /// Blocks new test assignments via WAP.
    /// </summary>
    Task SetMaintenanceAsync(int instrumentId, string reason, CancellationToken ct = default);

    /// <summary>
    /// Clears Maintenance — called on PM completion (Admin) or QA-approved repair.
    /// Instrument returns to Available.
    /// </summary>
    Task ClearMaintenanceAsync(int instrumentId, CancellationToken ct = default);
}
