using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using ReviewEntity = LIMS.Domain.Entities.ResultsReview;

namespace LIMS.Application.Features.ResultsReview;

// QC Lead verification: 3rd independent reviewer (FR-04, FR-05) — hard blocks: OOS open + no peer review
// After verification: CoA auto-generated (Draft) by ICoAGenerationService (Contract 1)
// Sample goes to PendingQAReview — Released only after QA approval (Phase 4)
public record QCLeadVerifyCommand(
    int ExecutionId, int QcLeadId,
    string Password, string Meaning, string Reason,
    string? Notes) : IRequest<Result<int>>;

public class QCLeadVerifyHandler : IRequestHandler<QCLeadVerifyCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IElectronicSignatureService _esig;
    private readonly INotificationService _notify;
    private readonly ICoAGenerationService _coaGen;

    public QCLeadVerifyHandler(ILimsDbContext db, IElectronicSignatureService esig,
        INotificationService notify, ICoAGenerationService coaGen)
    { _db = db; _esig = esig; _notify = notify; _coaGen = coaGen; }

    public async Task<Result<int>> Handle(QCLeadVerifyCommand cmd, CancellationToken ct)
    {
        var execution = await _db.TestExecutions
            .Include(e => e.Sample)
            .Include(e => e.ResultsReviews)
            .FirstOrDefaultAsync(e => e.ExecutionId == cmd.ExecutionId, ct);
        if (execution is null) return Result<int>.Failure("NOT_FOUND", "Execution not found.");

        // Peer review must be done first
        var peerReview = execution.ResultsReviews.FirstOrDefault(r => r.ReviewType == ReviewType.PeerReview);
        if (peerReview is null)
            return Result<int>.Failure("PEER_REVIEW_MISSING", "Peer review must be completed before QC Lead verification.");

        // Duplicate check — block if already QC-verified
        var alreadyVerified = execution.ResultsReviews.Any(r => r.ReviewType == ReviewType.QCLeadVerification);
        if (alreadyVerified)
            return Result<int>.Failure("ALREADY_VERIFIED", "QC Lead verification already completed for this execution.");

        // 4-eyes: QC Lead must be different from analyst AND peer reviewer (FR-05)
        if (execution.AnalystId == cmd.QcLeadId || peerReview.ReviewerId == cmd.QcLeadId)
            return Result<int>.Failure("SEGREGATION_VIOLATION",
                "QC Lead must be different from the analyst and peer reviewer. (GMP 4-eyes principle)");

        // OOS gate: hard block if any open OOS investigation (FR-07)
        var openOos = await _db.OosInvestigations.AnyAsync(
            i => i.ExecutionId == cmd.ExecutionId && i.Status == OosStatus.Open, ct);
        if (openOos)
            return Result<int>.Failure("OOS_OPEN",
                "Open OOS/OOT investigation(s) exist — QC Lead verification blocked until closed. (FDA OOS Guidance)");

        var sig = await _esig.CreateSignatureAsync(cmd.QcLeadId, cmd.Password, cmd.Meaning, cmd.Reason, "ResultsReview.QCLeadVerify", ct);
        if (sig is null) return Result<int>.Failure("ESIGN_AUTH_FAILED", "Password incorrect — e-signature rejected. (21 CFR §11.300)");

        var review = new ReviewEntity
        {
            SampleId = execution.SampleId,
            ExecutionId = cmd.ExecutionId,
            ReviewType = ReviewType.QCLeadVerification,
            ReviewerId = cmd.QcLeadId,
            SignatureId = sig.SignatureId,
            ReviewedAt = DateTimeOffset.UtcNow,
            Notes = cmd.Notes
        };
        _db.ResultsReviews.Add(review);

        // Execution moves to QCVerified — removes it from Results Review queue
        execution.Status = TestExecutionStatus.QCVerified;
        // Sample goes to PendingQAReview — Released only after QA CoA approval (Phase 4)
        execution.Sample.Status = SampleStatus.PendingQAReview;

        await _db.SaveChangesAsync(ct);

        // Auto-generate Draft CoA — best-effort: CoA failure must NOT block the QC verification
        // (CoA can be manually generated later via POST /coas/generate)
        try { await _coaGen.GenerateDraftAsync(execution.SampleId, cmd.ExecutionId, ct); }
        catch { /* CoA generation is non-critical — verification is already committed */ }

        await _notify.PushToGroupAsync("QA", "QCLeadVerified",
            new { executionId = cmd.ExecutionId, sampleId = execution.SampleId }, ct);

        return Result<int>.Success(review.ReviewId);
    }
}
