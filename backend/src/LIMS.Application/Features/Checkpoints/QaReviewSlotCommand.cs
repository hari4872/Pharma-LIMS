using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.Checkpoints;

public record QaReviewSlotCommand(
    int CheckpointId,
    int RowId,
    string Status,
    string? Comments,
    int UserId,
    string Username,
    string Password,
    string Meaning,
    string? Reason = null) : IRequest<Result<int>>;

public class QaReviewSlotCommandHandler : IRequestHandler<QaReviewSlotCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IElectronicSignatureService _esig;
    public QaReviewSlotCommandHandler(ILimsDbContext db, IElectronicSignatureService esig)
    { _db = db; _esig = esig; }

    public async Task<Result<int>> Handle(QaReviewSlotCommand request, CancellationToken ct)
    {
        var row = await _db.ProcessLogRows
            .FirstOrDefaultAsync(r => r.RowId == request.RowId && r.CheckpointId == request.CheckpointId, ct);
        if (row is null)
            return Result<int>.Failure("NOT_FOUND", "Execution row not found.");
        if (row.Status == "Open")
            return Result<int>.Failure("NOT_EXECUTED", "This slot has not been executed yet.");
        if (request.Status != "Approved" && request.Status != "Rejected")
            return Result<int>.Failure("INVALID_STATUS", "Status must be Approved or Rejected.");

        var sig = await _esig.CreateSignatureAsync(
            request.UserId, request.Password,
            request.Meaning, request.Reason ?? string.Empty,
            $"QaReviewSlot:{request.RowId}", ct);
        if (sig is null)
            return Result<int>.Failure("ESIGN_AUTH_FAILED",
                "Electronic signature failed — password incorrect. (21 CFR §11.300)");

        row.QaStatus      = request.Status;
        row.QaReviewedBy  = request.Username;
        row.QaReviewedAt  = DateTimeOffset.UtcNow;
        row.QaSignatureId = sig.SignatureId;
        await _db.SaveChangesAsync(ct);
        return Result<int>.Success(row.RowId);
    }
}
