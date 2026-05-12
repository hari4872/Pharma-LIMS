namespace LIMS.Application.Interfaces;

// Contract 1: INSERT-only audit writer — single service, no duplication
public interface IMasterDataAuditService
{
    Task LogAsync(
        string entityType,
        int entityId,
        string eventType,
        object? oldValue,
        object? newValue,
        string performedBy,
        CancellationToken cancellationToken = default);
}
