using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.DispatchQc;

// Sets Delivery Order status to Blocked — triggered by OOS detection or manual QA hold
public record BlockDispatchQcCommand(int DoId, string Reason, string BlockedBy) : IRequest<Result<int>>;

public class BlockDispatchQcHandler : IRequestHandler<BlockDispatchQcCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IDispatchStatusService _dispatchStatus;
    private readonly IMasterDataAuditService _audit;

    public BlockDispatchQcHandler(ILimsDbContext db, IDispatchStatusService dispatchStatus, IMasterDataAuditService audit)
    { _db = db; _dispatchStatus = dispatchStatus; _audit = audit; }

    public async Task<Result<int>> Handle(BlockDispatchQcCommand cmd, CancellationToken ct)
    {
        var order = await _db.DeliveryOrders.FirstOrDefaultAsync(d => d.DoId == cmd.DoId, ct);
        if (order is null) return Result<int>.Failure("NOT_FOUND", "Delivery Order not found.");
        if (order.Status == DispatchStatus.Cleared)
            return Result<int>.Failure("INVALID_STATE", "Delivery Order already cleared — cannot block.");

        try { await _dispatchStatus.SetStatusAsync(cmd.DoId, DispatchStatus.Blocked, ct); }
        catch { /* non-critical — status update failed but record is saved */ }
        try
        {
            await _audit.LogAsync("DeliveryOrder", cmd.DoId, "Blocked",
                new { PreviousStatus = order.Status.ToString() },
                new { Status = "Blocked", cmd.Reason }, cmd.BlockedBy);
        }
        catch { /* non-critical */ }

        return Result<int>.Success(cmd.DoId);
    }
}

// Unblocks a Delivery Order → InDispatchQC (CAPA closed, re-enter QC flow)
public record UnblockDispatchQcCommand(int DoId, string Reason, string UnblockedBy) : IRequest<Result<int>>;

public class UnblockDispatchQcHandler : IRequestHandler<UnblockDispatchQcCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IDispatchStatusService _dispatchStatus;
    private readonly IMasterDataAuditService _audit;

    public UnblockDispatchQcHandler(ILimsDbContext db, IDispatchStatusService dispatchStatus, IMasterDataAuditService audit)
    { _db = db; _dispatchStatus = dispatchStatus; _audit = audit; }

    public async Task<Result<int>> Handle(UnblockDispatchQcCommand cmd, CancellationToken ct)
    {
        var order = await _db.DeliveryOrders.FirstOrDefaultAsync(d => d.DoId == cmd.DoId, ct);
        if (order is null) return Result<int>.Failure("NOT_FOUND", "Delivery Order not found.");
        if (order.Status != DispatchStatus.Blocked)
            return Result<int>.Failure("INVALID_STATE", "Delivery Order is not blocked.");

        try { await _dispatchStatus.SetStatusAsync(cmd.DoId, DispatchStatus.InDispatchQC, ct); }
        catch { /* non-critical */ }
        try
        {
            await _audit.LogAsync("DeliveryOrder", cmd.DoId, "Unblocked",
                new { PreviousStatus = "Blocked" },
                new { Status = "InDispatchQC", cmd.Reason }, cmd.UnblockedBy);
        }
        catch { /* non-critical */ }

        return Result<int>.Success(cmd.DoId);
    }
}
