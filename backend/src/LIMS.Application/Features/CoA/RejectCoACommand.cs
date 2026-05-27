using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.CoA;

// QA rejection — INSERT-only record; justification mandatory
// EU Annex 11 §13: rejection record immutable even after DB restore
public record RejectCoACommand(
    int CoaId, int QaUserId,
    string Justification,
    string Password, string Meaning, string Reason) : IRequest<Result<int>>;

public class RejectCoAHandler : IRequestHandler<RejectCoACommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IElectronicSignatureService _esig;
    private readonly INotificationService _notify;

    public RejectCoAHandler(ILimsDbContext db, IElectronicSignatureService esig, INotificationService notify)
    { _db = db; _esig = esig; _notify = notify; }

    public async Task<Result<int>> Handle(RejectCoACommand cmd, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(cmd.Justification))
            return Result<int>.Failure("JUSTIFICATION_REQUIRED", "Rejection justification is mandatory. (EU Annex 11 §13)");

        var coa = await _db.Coas
            .Include(c => c.Sample)
            .FirstOrDefaultAsync(c => c.CoaId == cmd.CoaId, ct);
        if (coa is null) return Result<int>.Failure("NOT_FOUND", "CoA not found.");
        if (coa.Status != CoaStatus.Draft)
            return Result<int>.Failure("INVALID_STATE", $"CoA is {coa.Status} — only Draft CoAs can be rejected.");

        var sig = await _esig.CreateSignatureAsync(cmd.QaUserId, cmd.Password, cmd.Meaning, cmd.Reason,
            "CoA.QARejection", ct);
        if (sig is null) return Result<int>.Failure("ESIGN_AUTH_FAILED", "Password incorrect — e-signature rejected. (21 CFR §11.300)");

        // INSERT-only rejection record (EU Annex 11 §13 — never update this row)
        var approval = new CoaApproval
        {
            SampleId = coa.SampleId,
            CoaId = cmd.CoaId,
            Decision = "Rejected",
            Justification = cmd.Justification,
            SignatureId = sig.SignatureId,
            DecidedAt = DateTimeOffset.UtcNow
        };
        _db.CoaApprovals.Add(approval);

        coa.Status = CoaStatus.Rejected;          // prevent re-approval of rejected CoA
        coa.Sample.Status = SampleStatus.Rejected;
        await _db.SaveChangesAsync(ct);

        await _notify.PushToGroupAsync("QCLead", "CoARejected",
            new { coaId = cmd.CoaId, sampleId = coa.SampleId, justification = cmd.Justification }, ct);

        return Result<int>.Success(approval.ApprovalId);
    }
}
