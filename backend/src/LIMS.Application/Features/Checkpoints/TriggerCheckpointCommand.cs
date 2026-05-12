using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.Checkpoints;

// Mode 2: operator scan triggers checkpoint — offline-capable (EU Annex 11 §4.3)
public record TriggerCheckpointCommand(
    int CheckpointId, string TriggeredBy,
    string? DeliveryOrder = null,
    bool IsOfflineSync = false) : IRequest<Result<int>>;

public class TriggerCheckpointCommandHandler : IRequestHandler<TriggerCheckpointCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly ICheckpointTriggerService _trigger;
    private readonly INotificationService _notifications;

    public TriggerCheckpointCommandHandler(ILimsDbContext db, ICheckpointTriggerService trigger, INotificationService notifications)
    { _db = db; _trigger = trigger; _notifications = notifications; }

    public async Task<Result<int>> Handle(TriggerCheckpointCommand request, CancellationToken ct)
    {
        var checkpoint = await _db.Checkpoints.FirstOrDefaultAsync(c => c.CheckpointId == request.CheckpointId && c.IsActive, ct);
        if (checkpoint is null) return Result<int>.Failure("NOT_FOUND", "Checkpoint not found or inactive.");

        await _trigger.TriggerAsync(request.CheckpointId, checkpoint.TriggerMode.ToString(),
            request.TriggeredBy, request.DeliveryOrder, request.IsOfflineSync, ct);

        // Contract 2: push via SignalR — no polling
        await _notifications.PushToGroupAsync("Analyst", "CheckpointTriggered",
            new { request.CheckpointId, checkpoint.CheckpointCode, TriggerMode = checkpoint.TriggerMode.ToString() }, ct);

        return Result<int>.Success(request.CheckpointId);
    }
}
