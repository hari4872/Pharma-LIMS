namespace LIMS.Application.Interfaces;

// Contract 1: Single named service for full breakdown/repair lifecycle (FR-10)
// Steps: Raise → Record Repair → QA Return-to-Service (§11.50)
// OOC impact check run automatically after repair resolved (FR-16)

public record BreakdownResult(int BreakdownId, string InstrumentStatus);
public record ReturnToServiceResult(int BreakdownId, int SignatureId, bool OocImpactTriggered, int AffectedLogbookCount);

public interface IBreakdownRepairService
{
    /// <summary>
    /// Step 1: Raise breakdown. Instrument → Maintenance immediately.
    /// WAP flags pending assignments for reallocation (FR-10, FR-11).
    /// </summary>
    Task<BreakdownResult> RaiseBreakdownAsync(int instrumentId, int raisedByUserId, string issueDescription, CancellationToken ct = default);

    /// <summary>
    /// Step 2: Record repair details. Breakdown → InRepair.
    /// </summary>
    Task<int> RecordRepairAsync(int breakdownId, string technician, DateOnly repairDate, string repairDescription, string? partsUsed, string recordedBy, CancellationToken ct = default);

    /// <summary>
    /// Step 3: QA return-to-service (§11.50 e-sig required).
    /// Instrument → Available. OOCImpactService runs for breakdown window (FR-16).
    /// </summary>
    Task<ReturnToServiceResult> ReturnToServiceAsync(int breakdownId, int qaUserId, string password, string meaning, string reason, CancellationToken ct = default);
}
