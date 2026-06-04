using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.Checkpoints;

// Mode 2: operator scan triggers checkpoint — offline-capable (EU Annex 11 §4.3)
public record TriggerCheckpointCommand(
    int CheckpointId, string TriggeredBy,
    string? DeliveryOrder = null,
    bool IsOfflineSync = false,
    int? SampleId = null) : IRequest<Result<int>>;

public class TriggerCheckpointCommandHandler : IRequestHandler<TriggerCheckpointCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly ICheckpointTriggerService _trigger;
    private readonly INotificationService _notifications;

    public TriggerCheckpointCommandHandler(ILimsDbContext db, ICheckpointTriggerService trigger, INotificationService notifications)
    { _db = db; _trigger = trigger; _notifications = notifications; }

    public async Task<Result<int>> Handle(TriggerCheckpointCommand request, CancellationToken ct)
    {
        // Gap 1 fix: include FormTemplate so trigger service knows which form to use
        var checkpoint = await _db.Checkpoints
            .Include(c => c.FormTemplate)
            .FirstOrDefaultAsync(c => c.CheckpointId == request.CheckpointId && c.IsActive, ct);
        if (checkpoint is null) return Result<int>.Failure("NOT_FOUND", "Checkpoint not found or inactive.");

        // Enforce FK: non-DispatchEvent checkpoints must have a FormTemplate configured
        if (checkpoint.TriggerMode != TriggerType.DispatchEvent && checkpoint.FormTemplateId is null)
            return Result<int>.Failure("FORM_TEMPLATE_MISSING",
                $"Checkpoint '{checkpoint.CheckpointCode}' has no Form Template assigned. Configure one in Master Data before triggering.");

        await _trigger.TriggerAsync(request.CheckpointId, checkpoint.TriggerMode.ToString(),
            request.TriggeredBy, request.DeliveryOrder, request.IsOfflineSync, ct);

        // OperatorScan + SampleId: create an Open ProcessLogRow linked to the sample
        // This closes the traceability gap — in-process check is directly tied to the batch
        if (checkpoint.TriggerMode == TriggerType.OperatorScan && request.SampleId.HasValue)
        {
            var sample = await _db.Samples.FindAsync([request.SampleId.Value], ct);
            if (sample is not null)
            {
                _db.ProcessLogRows.Add(new ProcessLogRow
                {
                    CheckpointId = request.CheckpointId,
                    SampleId     = request.SampleId.Value,
                    SlotTime     = DateTimeOffset.UtcNow,
                    SlotLabel    = "OperatorScan",
                    Status       = "Open",
                });
                await _db.SaveChangesAsync(ct);
            }
        }

        // Contract 2: push via SignalR — no polling
        await _notifications.PushToGroupAsync("Analyst", "CheckpointTriggered",
            new { request.CheckpointId, checkpoint.CheckpointCode, TriggerMode = checkpoint.TriggerMode.ToString(),
                  FormTemplateId = checkpoint.FormTemplateId }, ct);

        return Result<int>.Success(request.CheckpointId);
    }
}
