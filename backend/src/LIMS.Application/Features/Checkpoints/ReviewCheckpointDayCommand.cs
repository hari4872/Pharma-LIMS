using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.Checkpoints;

public record ReviewCheckpointDayCommand(
    int CheckpointId,
    DateOnly ReviewDate,
    string Status,
    string? Comments,
    int UserId,
    string Username,
    string Password,
    string Meaning,
    string? Reason = null) : IRequest<Result<int>>;

public class ReviewCheckpointDayCommandHandler : IRequestHandler<ReviewCheckpointDayCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IElectronicSignatureService _esig;
    public ReviewCheckpointDayCommandHandler(ILimsDbContext db, IElectronicSignatureService esig)
    { _db = db; _esig = esig; }

    public async Task<Result<int>> Handle(ReviewCheckpointDayCommand request, CancellationToken ct)
    {
        var cp = await _db.Checkpoints.FirstOrDefaultAsync(c => c.CheckpointId == request.CheckpointId, ct);
        if (cp is null) return Result<int>.Failure("NOT_FOUND", "Checkpoint not found.");

        if (request.Status != "Approved" && request.Status != "Rejected")
            return Result<int>.Failure("INVALID_STATUS", "Status must be Approved or Rejected.");

        var sig = await _esig.CreateSignatureAsync(request.UserId, request.Password,
            request.Meaning, request.Reason ?? string.Empty, $"CheckpointReview:{request.CheckpointId}:{request.ReviewDate}", ct);
        if (sig is null)
            return Result<int>.Failure("ESIGN_AUTH_FAILED", "Electronic signature failed — password incorrect. (21 CFR §11.300)");

        var existing = await _db.CheckpointDailyReviews
            .FirstOrDefaultAsync(r => r.CheckpointId == request.CheckpointId && r.ReviewDate == request.ReviewDate, ct);

        if (existing is not null)
        {
            existing.Status     = request.Status;
            existing.Comments   = request.Comments;
            existing.ReviewedBy = request.Username;
            existing.ReviewedAt = DateTimeOffset.UtcNow;
            existing.SignatureId = sig.SignatureId;
            await _db.SaveChangesAsync(ct);
            return Result<int>.Success(existing.CheckpointDailyReviewId);
        }

        var review = new CheckpointDailyReview
        {
            CheckpointId = request.CheckpointId,
            ReviewDate   = request.ReviewDate,
            Status       = request.Status,
            Comments     = request.Comments,
            ReviewedBy   = request.Username,
            ReviewedAt   = DateTimeOffset.UtcNow,
            SignatureId  = sig.SignatureId,
        };
        _db.CheckpointDailyReviews.Add(review);
        await _db.SaveChangesAsync(ct);
        return Result<int>.Success(review.CheckpointDailyReviewId);
    }
}
