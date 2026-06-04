using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Infrastructure.Services;

// Contract 1: Single CLEARED/BLOCKED setter — no role can manually set CLEARED
// Contract 2: Status set server-side only on QA approval
public class DispatchStatusService : IDispatchStatusService
{
    private readonly ILimsDbContext _db;
    private readonly IMasterDataAuditService _audit;

    public DispatchStatusService(ILimsDbContext db, IMasterDataAuditService audit)
    { _db = db; _audit = audit; }

    public async Task SetStatusAsync(int doId, DispatchStatus status, CancellationToken ct = default)
    {
        var deliveryOrder = await _db.DeliveryOrders.FindAsync([doId], ct)
            ?? throw new InvalidOperationException($"Delivery Order {doId} not found.");

        var oldStatus = deliveryOrder.Status;
        deliveryOrder.Status = status;
        await _db.SaveChangesAsync(ct);
        await _audit.LogAsync("DeliveryOrder", doId, "StatusChanged",
            new { Status = oldStatus.ToString() },
            new { Status = status.ToString() },
            "System");
    }
}
