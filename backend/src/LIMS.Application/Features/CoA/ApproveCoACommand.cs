using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.CoA;

// QA §11.50 approval — locks PDF atomically (Contract 1, Contract 2)
// 10-item checklist enforced by IQAReviewGateService (Contract 1)
// IsConditionalRelease = true bypasses soft gates (items 7, 8) with mandatory justification
public record ApproveCoACommand(
    int CoaId, int QaUserId,
    string Password, string Meaning, string Reason,
    bool IsConditionalRelease = false,
    string? ConditionalJustification = null) : IRequest<Result<int>>;

public class ApproveCoAHandler : IRequestHandler<ApproveCoACommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IElectronicSignatureService _esig;
    private readonly IQAReviewGateService _qaGate;
    private readonly ICoADistributionService _distribution;
    private readonly INotificationService _notify;

    public ApproveCoAHandler(ILimsDbContext db, IElectronicSignatureService esig,
        IQAReviewGateService qaGate, ICoADistributionService distribution, INotificationService notify)
    { _db = db; _esig = esig; _qaGate = qaGate; _distribution = distribution; _notify = notify; }

    public async Task<Result<int>> Handle(ApproveCoACommand cmd, CancellationToken ct)
    {
        var coa = await _db.Coas
            .Include(c => c.Sample)
            .FirstOrDefaultAsync(c => c.CoaId == cmd.CoaId, ct);
        if (coa is null) return Result<int>.Failure("NOT_FOUND", "CoA not found.");
        if (coa.Status != CoaStatus.Draft)
            return Result<int>.Failure("INVALID_STATE", $"CoA is already {coa.Status}. Only Draft CoAs can be approved.");

        // Conditional release requires a justification
        if (cmd.IsConditionalRelease && string.IsNullOrWhiteSpace(cmd.ConditionalJustification))
            return Result<int>.Failure("JUSTIFICATION_REQUIRED", "Conditional release requires a written justification.");

        // QA checklist — hard gates always enforced; soft gates (items 1, 6, 7, 8) bypassed for conditional release
        var checklist = await _qaGate.EvaluateChecklistAsync(coa.SampleId, cmd.CoaId, ct);
        // Hard gates — never bypassed (absolute regulatory minimums: no open OOS/OOT, analyst sigs, CoA body)
        var hardGatesPassed = checklist.NoOpenOos && checklist.NoOpenOot &&
                              checklist.AnalystSigsPresent && checklist.PeerReviewPresent &&
                              checklist.CoaBodyComplete;
        // Soft gates — bypassed with mandatory written justification for conditional release
        var softGatesPassed = checklist.TestsComplete && checklist.QcLeadVerifPresent &&
                              checklist.CorrectSpecVersion && checklist.EvidencePresent;
        var effectivePassed = hardGatesPassed && (softGatesPassed || cmd.IsConditionalRelease);

        if (!effectivePassed)
        {
            var failed = new List<string>();
            if (!cmd.IsConditionalRelease && !checklist.TestsComplete) failed.Add("Item 1: Not all test executions complete");
            if (!checklist.NoOpenOos)           failed.Add("Item 2: Open OOS investigation(s) exist");
            if (!checklist.NoOpenOot)           failed.Add("Item 3: Open OOT investigation(s) exist");
            if (!checklist.AnalystSigsPresent)  failed.Add("Item 4: Missing analyst e-signatures on logbook entries");
            if (!checklist.PeerReviewPresent)   failed.Add("Item 5: Peer review e-signature missing");
            if (!cmd.IsConditionalRelease && !checklist.QcLeadVerifPresent) failed.Add("Item 6: QC Lead verification e-signature missing");
            if (!cmd.IsConditionalRelease && !checklist.CorrectSpecVersion) failed.Add("Item 7: Incorrect or unapproved spec version used");
            if (!cmd.IsConditionalRelease && !checklist.EvidencePresent)    failed.Add("Item 8: Evidence missing for critical parameter(s)");
            if (!checklist.CoaHeaderPopulated)  failed.Add("Item 9: CoA header fields incomplete");
            if (!checklist.CoaBodyComplete)     failed.Add("Item 10: CoA body has blank result field(s)");
            if (!checklist.DispatchQcPassed)    failed.Add("Item 11: Dispatch QC not cleared");
            return Result<int>.Failure("CHECKLIST_FAILED",
                "QA checklist failed — " + string.Join("; ", failed));
        }

        // §11.300 password verification independent of session
        var sig = await _esig.CreateSignatureAsync(cmd.QaUserId, cmd.Password, cmd.Meaning, cmd.Reason,
            "CoA.QAApproval", ct);
        if (sig is null) return Result<int>.Failure("ESIGN_AUTH_FAILED", "Password incorrect — e-signature rejected. (21 CFR §11.300)");

        // Atomic: lock CoA + generate PDF + set signature — all in one transaction
        coa.Status = CoaStatus.Released;
        coa.LockedAt = DateTimeOffset.UtcNow;
        coa.QaSignatureId = sig.SignatureId;
        coa.IsConditionalRelease = cmd.IsConditionalRelease;
        coa.ConditionalJustification = cmd.ConditionalJustification;
        // PDF generation: embed 3 e-sigs — stored as minimal marker for now (full PDF renderer in Phase 9 infra)
        coa.PdfBlob = System.Text.Encoding.UTF8.GetBytes($"COA:{coa.CoaNumber}|LOCKED:{coa.LockedAt:O}|QA:{sig.FullName}");

        // Sample stays PendingQAReview — Released only after Batch Release decision (21 CFR 211.192)

        var approval = new CoaApproval
        {
            SampleId = coa.SampleId,
            CoaId = cmd.CoaId,
            Decision = cmd.IsConditionalRelease ? "Cond.Rel" : "Approved",
            Justification = cmd.ConditionalJustification,
            SignatureId = sig.SignatureId,
            DecidedAt = DateTimeOffset.UtcNow
        };
        _db.CoaApprovals.Add(approval);

        // Note: Batch Release is initiated manually from the Batch Release tab

        try
        {
            await _db.SaveChangesAsync(ct);
        }
        catch (Microsoft.EntityFrameworkCore.DbUpdateException ex)
        {
            var inner = ex.InnerException?.Message ?? ex.Message;
            return Result<int>.Failure("DB_SAVE_FAILED", $"Save failed: {inner}");
        }

        // Distribution + notification: best-effort — never block approval if these fail
        try { await _distribution.DistributeAsync(cmd.CoaId, ct); } catch { /* non-critical */ }
        try
        {
            await _notify.PushToGroupAsync("Dispatch", "CoAReady",
                new { coaId = cmd.CoaId, sampleId = coa.SampleId, coaNumber = coa.CoaNumber }, ct);
        }
        catch { /* non-critical */ }

        return Result<int>.Success(approval.ApprovalId);
    }
}
