using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.DispatchQc;

// QA §11.50 approval on Dispatch QC task — sets CLEARED via DispatchStatusService (Contract 1)
public record ApproveDispatchQcCommand(
    int TaskId, int QaUserId,
    string Password, string Meaning, string Reason) : IRequest<Result<int>>;

public class ApproveDispatchQcHandler : IRequestHandler<ApproveDispatchQcCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IElectronicSignatureService _esig;
    private readonly IDispatchStatusService _dispatchStatus;
    private readonly INotificationService _notify;

    public ApproveDispatchQcHandler(ILimsDbContext db, IElectronicSignatureService esig,
        IDispatchStatusService dispatchStatus, INotificationService notify)
    { _db = db; _esig = esig; _dispatchStatus = dispatchStatus; _notify = notify; }

    public async Task<Result<int>> Handle(ApproveDispatchQcCommand cmd, CancellationToken ct)
    {
        var task = await _db.DispatchQcTasks
            .Include(t => t.DeliveryOrder)
            .FirstOrDefaultAsync(t => t.TaskId == cmd.TaskId, ct);
        if (task is null) return Result<int>.Failure("NOT_FOUND", "Dispatch QC task not found.");
        if (task.Status != DispatchTaskStatus.Passed)
            return Result<int>.Failure("INVALID_STATE", "Dispatch QC task must have status Passed before QA approval.");

        // OOS gate: no dispatch while any OOS open for this execution (FDA OOS Guidance)
        if (task.ExecutionId.HasValue)
        {
            var openOos = await _db.OosInvestigations
                .AnyAsync(i => i.ExecutionId == task.ExecutionId && i.Status == OosStatus.Open, ct);
            if (openOos)
                return Result<int>.Failure("OOS_OPEN",
                    "Open OOS/OOT investigation exists — Dispatch QC cannot be cleared. (FDA OOS Guidance)");
        }

        var sig = await _esig.CreateSignatureAsync(cmd.QaUserId, cmd.Password, cmd.Meaning, cmd.Reason,
            "DispatchQC.QAApproval", ct);
        if (sig is null) return Result<int>.Failure("ESIGN_AUTH_FAILED", "Password incorrect. (21 CFR §11.300)");

        task.Status = DispatchTaskStatus.QAApproved;
        await _db.SaveChangesAsync(ct);

        // Status update + notification are best-effort — QA approval is already committed
        try { await _dispatchStatus.SetStatusAsync(task.DoId, DispatchStatus.Cleared, ct); }
        catch { /* non-critical */ }
        try
        {
            await _notify.PushToGroupAsync("QA", "DispatchCleared",
                new { taskId = cmd.TaskId, doId = task.DoId, doNumber = task.DeliveryOrder?.DoNumber }, ct);
        }
        catch { /* non-critical */ }

        return Result<int>.Success(cmd.TaskId);
    }
}
