namespace LIMS.Domain.Entities;

// 21 CFR §11.10(e): INSERT-only at DB level — DB trigger prevents UPDATE/DELETE
public class MasterDataAuditLog
{
    public long AuditId { get; set; }
    public string EntityType { get; set; } = default!;
    public int EntityId { get; set; }
    public string EventType { get; set; } = default!;     // Created | Updated | Approved | Retired
    public string? OldValue { get; set; }                  // JSONB
    public string? NewValue { get; set; }                  // JSONB
    public string PerformedBy { get; set; } = default!;
    public DateTimeOffset PerformedAt { get; set; } = DateTimeOffset.UtcNow;
}
