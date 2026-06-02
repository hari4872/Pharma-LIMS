using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using ReviewEntity = LIMS.Domain.Entities.ResultsReview;

namespace LIMS.Application.Features.ResultsReview;

// 4-eyes peer review: 2nd analyst reviews all logbook rows for a sample (FR-02, FR-03)
public record PeerReviewCommand(
    int ExecutionId, int ReviewerId,
    string Password, string Meaning, string Reason,
    string? Notes) : IRequest<Result<int>>;

public class PeerReviewHandler : IRequestHandler<PeerReviewCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IElectronicSignatureService _esig;
    private readonly INotificationService _notify;

    public PeerReviewHandler(ILimsDbContext db, IElectronicSignatureService esig, INotificationService notify)
    { _db = db; _esig = esig; _notify = notify; }

    public async Task<Result<int>> Handle(PeerReviewCommand cmd, CancellationToken ct)
    {
        var execution = await _db.TestExecutions
            .Include(e => e.Sample)
            .FirstOrDefaultAsync(e => e.ExecutionId == cmd.ExecutionId, ct);
        if (execution is null) return Result<int>.Failure("NOT_FOUND", "Execution not found.");
        if (execution.Status != TestExecutionStatus.Completed)
            return Result<int>.Failure("INVALID_STATE", "Execution must be Completed for peer review.");

        // 4-eyes: peer must NOT be the original analyst (FR-03 — user_id equality check, not just role)
        if (execution.AnalystId == cmd.ReviewerId)
            return Result<int>.Failure("SEGREGATION_VIOLATION",
                "Peer reviewer cannot be the same analyst who performed the test. (GMP 4-eyes principle)");

        // OOS gate: peer review blocked if open OOS investigations exist (FDA OOS Guidance 2006)
        var openOos = await _db.OosInvestigations.AnyAsync(
            i => i.ExecutionId == cmd.ExecutionId && i.Status == OosStatus.Open, ct);
        if (openOos)
            return Result<int>.Failure("OOS_OPEN",
                "Open OOS/OOT investigation(s) must be closed before peer review. (FDA OOS Guidance)");

        // Duplicate review check
        var alreadyReviewed = await _db.ResultsReviews.AnyAsync(
            r => r.ExecutionId == cmd.ExecutionId && r.ReviewType == ReviewType.PeerReview, ct);
        if (alreadyReviewed)
            return Result<int>.Failure("ALREADY_REVIEWED", "Peer review already completed for this execution.");

        var sig = await _esig.CreateSignatureAsync(cmd.ReviewerId, cmd.Password, cmd.Meaning, cmd.Reason, "ResultsReview.PeerReview", ct);
        if (sig is null) return Result<int>.Failure("ESIGN_AUTH_FAILED", "Password incorrect — e-signature rejected. (21 CFR §11.300)");

        var review = new ReviewEntity
        {
            SampleId = execution.SampleId,
            ExecutionId = cmd.ExecutionId,
            ReviewType = ReviewType.PeerReview,
            ReviewerId = cmd.ReviewerId,
            SignatureId = sig.SignatureId,
            ReviewedAt = DateTimeOffset.UtcNow,
            Notes = cmd.Notes
        };
        _db.ResultsReviews.Add(review);
        execution.Status = TestExecutionStatus.PeerReviewed;
        await _db.SaveChangesAsync(ct);

        await _notify.PushToGroupAsync("QCLead", "PeerReviewCompleted",
            new { executionId = cmd.ExecutionId, sampleId = execution.SampleId }, ct);

        return Result<int>.Success(review.ReviewId);
    }
}
