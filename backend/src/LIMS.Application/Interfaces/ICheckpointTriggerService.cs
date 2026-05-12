namespace LIMS.Application.Interfaces;

// Contract 1: single service for all 4 trigger modes — no duplicate trigger path
public interface ICheckpointTriggerService
{
    Task TriggerAsync(int checkpointId, string triggerMode, string? triggeredBy,
        string? deliveryOrder = null, bool isOfflineSync = false, CancellationToken ct = default);
}
