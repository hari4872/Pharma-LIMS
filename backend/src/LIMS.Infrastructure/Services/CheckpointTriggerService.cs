using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Infrastructure.Services;

// Contract 1: single service for all 4 trigger modes — no duplicate trigger path (FR-04)
public class CheckpointTriggerService : ICheckpointTriggerService
{
    private readonly ILimsDbContext _db;
    public CheckpointTriggerService(ILimsDbContext db) => _db = db;

    public async Task TriggerAsync(int checkpointId, string triggerMode, string? triggeredBy,
        string? deliveryOrder = null, bool isOfflineSync = false, CancellationToken ct = default)
    {
        // All 4 modes logged INSERT-only — ALCOA+ Contemporaneous (FR-05)
        _db.CheckpointTriggerLogs.Add(new CheckpointTriggerLog
        {
            CheckpointId = checkpointId,
            TriggerMode = triggerMode,
            TriggeredBy = triggeredBy,
            TriggeredAt = DateTimeOffset.UtcNow,    // Contract 2: UTC server-side
            DeliveryOrder = deliveryOrder,
            IsOfflineSync = isOfflineSync
        });
        await _db.SaveChangesAsync(ct);
    }
}
