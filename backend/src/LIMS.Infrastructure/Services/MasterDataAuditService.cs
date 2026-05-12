using System.Text.Json;
using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Infrastructure.Persistence;

namespace LIMS.Infrastructure.Services;

// Contract 1: INSERT-only audit writer — no UPDATE/DELETE ever
public class MasterDataAuditService : IMasterDataAuditService
{
    private readonly LimsDbContext _db;
    public MasterDataAuditService(LimsDbContext db) => _db = db;

    public async Task LogAsync(string entityType, int entityId, string eventType, object? oldValue, object? newValue, string performedBy, CancellationToken cancellationToken = default)
    {
        var log = new MasterDataAuditLog
        {
            EntityType = entityType,
            EntityId = entityId,
            EventType = eventType,
            OldValue = oldValue is not null ? JsonSerializer.Serialize(oldValue) : null,
            NewValue = newValue is not null ? JsonSerializer.Serialize(newValue) : null,
            PerformedBy = performedBy,
            PerformedAt = DateTimeOffset.UtcNow   // Contract 2: UTC server-side
        };
        _db.MasterDataAuditLogs.Add(log);
        await _db.SaveChangesAsync(cancellationToken);
    }
}
