using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using ReviewEntity = LIMS.Domain.Entities.ResultsReview;

namespace LIMS.Application.Features.ResultsReview;

// Peer Review Reject — sends execution back to InProgress for analyst rework
public record RejectPeerReviewCommand(
    int ExecutionId, int ReviewerId,
    string Password, string Meaning, string Reason,
    string? Notes) : IRequest<Result<int>>;

public class RejectPeerReviewHandler : IRequestHandler<RejectPeerReviewCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IElectronicSignatureService _esig;
    private readonly IMasterDataAuditService _audit;

    public RejectPeerReviewHandler(ILimsDbContext db, IElectronicSignatureService esig, IMasterDataAuditService audit)
    { _db = db; _esig = esig; _audit = audit; }

    public async Task<Result<int>> Handle(RejectPeerReviewCommand cmd, CancellationToken ct)
    {
        var execution = await _db.TestExecutions.FirstOrDefaultAsync(e => e.ExecutionId == cmd.ExecutionId, ct);
        if (execution is null) return Result<int>.Failure("NOT_FOUND", "Execution not found.");
        if (execution.Status != TestExecutionStatus.Completed)
            return Result<int>.Failure("INVALID_STATE", "Only Completed executions can be rejected at peer review stage.");

        if (string.IsNullOrWhiteSpace(cmd.Reason))
            return Result<int>.Failure("REASON_REQUIRED", "Rejection reason is mandatory.");

        var sig = await _esig.CreateSignatureAsync(cmd.ReviewerId, cmd.Password, cmd.Meaning, cmd.Reason, "ResultsReview.PeerReviewReject", ct);
        if (sig is null) return Result<int>.Failure("ESIGN_AUTH_FAILED", "Password incorrect — e-signature rejected. (21 CFR §11.300)");

        var review = new ReviewEntity
        {
            SampleId = execution.SampleId,
            ExecutionId = cmd.ExecutionId,
            ReviewType = ReviewType.PeerReviewRejected,
            ReviewerId = cmd.ReviewerId,
            SignatureId = sig.SignatureId,
            ReviewedAt = DateTimeOffset.UtcNow,
            Notes = cmd.Notes,
        };
        _db.ResultsReviews.Add(review);
        execution.Status = TestExecutionStatus.InProgress;
        await _db.SaveChangesAsync(ct);

        try { await _audit.LogAsync("ResultsReview", cmd.ExecutionId, "PeerReviewRejected", null,
            new { Reason = cmd.Reason, ReviewerId = cmd.ReviewerId }, sig.FullName); } catch { }

        return Result<int>.Success(review.ReviewId);
    }
}

// QC Lead Reject — also sends execution back to InProgress for analyst rework
public record RejectQCLeadCommand(
    int ExecutionId, int ReviewerId,
    string Password, string Meaning, string Reason,
    string? Notes) : IRequest<Result<int>>;

public class RejectQCLeadHandler : IRequestHandler<RejectQCLeadCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IElectronicSignatureService _esig;
    private readonly IMasterDataAuditService _audit;

    public RejectQCLeadHandler(ILimsDbContext db, IElectronicSignatureService esig, IMasterDataAuditService audit)
    { _db = db; _esig = esig; _audit = audit; }

    public async Task<Result<int>> Handle(RejectQCLeadCommand cmd, CancellationToken ct)
    {
        var execution = await _db.TestExecutions.FirstOrDefaultAsync(e => e.ExecutionId == cmd.ExecutionId, ct);
        if (execution is null) return Result<int>.Failure("NOT_FOUND", "Execution not found.");
        if (execution.Status != TestExecutionStatus.PeerReviewed)
            return Result<int>.Failure("INVALID_STATE", "Only PeerReviewed executions can be rejected at QC stage.");

        if (string.IsNullOrWhiteSpace(cmd.Reason))
            return Result<int>.Failure("REASON_REQUIRED", "Rejection reason is mandatory.");

        var sig = await _esig.CreateSignatureAsync(cmd.ReviewerId, cmd.Password, cmd.Meaning, cmd.Reason, "ResultsReview.QCLeadReject", ct);
        if (sig is null) return Result<int>.Failure("ESIGN_AUTH_FAILED", "Password incorrect — e-signature rejected. (21 CFR §11.300)");

        var review = new ReviewEntity
        {
            SampleId = execution.SampleId,
            ExecutionId = cmd.ExecutionId,
            ReviewType = ReviewType.QCLeadRejected,
            ReviewerId = cmd.ReviewerId,
            SignatureId = sig.SignatureId,
            ReviewedAt = DateTimeOffset.UtcNow,
            Notes = cmd.Notes,
        };
        _db.ResultsReviews.Add(review);
        execution.Status = TestExecutionStatus.InProgress;
        await _db.SaveChangesAsync(ct);

        try { await _audit.LogAsync("ResultsReview", cmd.ExecutionId, "QCLeadRejected", null,
            new { Reason = cmd.Reason, ReviewerId = cmd.ReviewerId }, sig.FullName); } catch { }

        return Result<int>.Success(review.ReviewId);
    }
}
