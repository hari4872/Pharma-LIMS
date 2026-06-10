using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.DeliveryOrders;

public record CreateDeliveryOrderCommand(
    string DoNumber,
    string? CustomerName,
    DateOnly? DespatchDate,
    string? PackingType,
    int ProductId,
    string CreatedBy) : IRequest<Result<int>>;

public class CreateDeliveryOrderHandler : IRequestHandler<CreateDeliveryOrderCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IDispatchEventService _dispatchEvent;
    private readonly INotificationService _notify;

    public CreateDeliveryOrderHandler(ILimsDbContext db, IDispatchEventService dispatchEvent, INotificationService notify)
    { _db = db; _dispatchEvent = dispatchEvent; _notify = notify; }

    public async Task<Result<int>> Handle(CreateDeliveryOrderCommand cmd, CancellationToken ct)
    {
        // Validate DO number uniqueness
        var duplicate = await _db.DeliveryOrders.AnyAsync(d => d.DoNumber == cmd.DoNumber, ct);
        if (duplicate)
            return Result<int>.Failure("DUPLICATE_DO", $"Delivery Order '{cmd.DoNumber}' already exists.");

        var product = await _db.Materials.FindAsync([cmd.ProductId], ct);
        if (product is null) return Result<int>.Failure("PRODUCT_NOT_FOUND", "Product (Material) not found.");

        var do_ = new DeliveryOrder
        {
            DoNumber    = cmd.DoNumber,
            CustomerName = cmd.CustomerName,
            DespatchDate = cmd.DespatchDate,
            PackingType  = cmd.PackingType,
            ProductId    = cmd.ProductId,
        };
        _db.DeliveryOrders.Add(do_);
        await _db.SaveChangesAsync(ct);

        // DispatchEventService + notification are best-effort — DO creation is already committed
        try { await _dispatchEvent.CreateTaskAsync(do_.DoId, ct); }
        catch { /* non-critical — task can be created manually if this fails */ }
        try
        {
            await _notify.PushToGroupAsync("Analyst", "DOReceived",
                new { doId = do_.DoId, doNumber = do_.DoNumber, customer = do_.CustomerName }, ct);
        }
        catch { /* non-critical */ }

        return Result<int>.Success(do_.DoId);
    }
}
