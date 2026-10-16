using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.OosInvestigations;

public record QAFinalDecisionCommand(
    int InvestigationId, int UserId,
    OosFinalDecision Decision,
    string? Notes,
    string Password, string Meaning, string Reason) : IRequest<Result<int>>;

public class QAFinalDecisionHandler : IRequestHandler<QAFinalDecisionCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IElectronicSignatureService _esig;
    private readonly IMasterDataAuditService _audit;

    public QAFinalDecisionHandler(ILimsDbContext db, IElectronicSignatureService esig, IMasterDataAuditService audit)
    { _db = db; _esig = esig; _audit = audit; }

    public async Task<Result<int>> Handle(QAFinalDecisionCommand cmd, CancellationToken ct)
    {
        var inv = await _db.OosInvestigations
            .Include(i => i.Execution).ThenInclude(e => e.Sample)
            .FirstOrDefaultAsync(i => i.InvestigationId == cmd.InvestigationId, ct);

        if (inv is null) return Result<int>.Failure("NOT_FOUND", "Investigation not found.");
        if (inv.Status == OosStatus.Closed)
            return Result<int>.Failure("ALREADY_CLOSED", "Investigation is already closed.");
        if (!inv.PostReworkRetestExecutionId.HasValue)
            return Result<int>.Failure("NO_POSTREWORK_RETEST", "Post-rework retest must be completed before QA final decision.");
        if (inv.FinalDecision.HasValue)
            return Result<int>.Failure("ALREADY_DECIDED", "A QA final decision has already been recorded.");
        if (inv.Execution?.Sample is null)
            return Result<int>.Failure("DATA_ERROR", "Sample data could not be loaded.");

        var sig = await _esig.CreateSignatureAsync(cmd.UserId, cmd.Password, cmd.Meaning, cmd.Reason,
            "OosInvestigation.FinalDecision", ct);
        if (sig is null)
            return Result<int>.Failure("ESIGN_AUTH_FAILED", "Password incorrect — e-signature rejected. (21 CFR §11.300)");

        var user = await _db.Users.FindAsync(new object[] { cmd.UserId }, ct);

        inv.FinalDecision   = cmd.Decision;
        inv.FinalDecisionAt = DateTimeOffset.UtcNow;
        inv.FinalDecisionBy = user?.FullName ?? sig.FullName;
        inv.ResolutionType  = OosResolutionType.GenuineOOS;
        inv.Status          = OosStatus.Closed;
        inv.ClosedAt        = DateTimeOffset.UtcNow;
        inv.SignatureId     = sig.SignatureId;
        if (!string.IsNullOrWhiteSpace(cmd.Notes))
            inv.RootCause = string.IsNullOrWhiteSpace(inv.RootCause) ? cmd.Notes : inv.RootCause + "; " + cmd.Notes;

        inv.Execution.Sample.Status = cmd.Decision == OosFinalDecision.Release
            ? SampleStatus.PendingQAReview
            : SampleStatus.Rejected;

        await _db.SaveChangesAsync(ct);

        try
        {
            await _audit.LogAsync("OosInvestigation", inv.InvestigationId, "QAFinalDecision",
                new { Status = "Open" },
                new { Decision = cmd.Decision.ToString(), SampleStatus = inv.Execution.Sample.Status.ToString(), SignatureId = sig.SignatureId },
                sig.FullName);
        }
        catch { }

        return Result<int>.Success(inv.InvestigationId);
    }
}
