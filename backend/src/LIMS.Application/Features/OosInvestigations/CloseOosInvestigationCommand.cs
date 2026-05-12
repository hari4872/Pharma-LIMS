using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.OosInvestigations;

// QA/QCLead closes OOS investigation with root cause + CAPA + §11.50 e-sig
public record CloseOosInvestigationCommand(
    int InvestigationId, int UserId,
    string RootCause, string? CapaRef,
    string Password, string Meaning, string Reason) : IRequest<Result<int>>;

public class CloseOosInvestigationHandler : IRequestHandler<CloseOosInvestigationCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IElectronicSignatureService _esig;
    private readonly INotificationService _notify;

    public CloseOosInvestigationHandler(ILimsDbContext db, IElectronicSignatureService esig, INotificationService notify)
    { _db = db; _esig = esig; _notify = notify; }

    public async Task<Result<int>> Handle(CloseOosInvestigationCommand cmd, CancellationToken ct)
    {
        var inv = await _db.OosInvestigations
            .Include(i => i.Execution).ThenInclude(e => e.Sample)
            .FirstOrDefaultAsync(i => i.InvestigationId == cmd.InvestigationId, ct);
        if (inv is null) return Result<int>.Failure("NOT_FOUND", "Investigation not found.");
        if (inv.Status == OosStatus.Closed)
            return Result<int>.Failure("ALREADY_CLOSED", "Investigation is already closed.");

        var sig = await _esig.CreateSignatureAsync(cmd.UserId, cmd.Password, cmd.Meaning, cmd.Reason, "OosInvestigation.Close", ct);
        if (sig is null) return Result<int>.Failure("ESIGN_AUTH_FAILED", "Password incorrect — e-signature rejected. (21 CFR §11.300)");

        inv.Status = OosStatus.Closed;
        inv.RootCause = cmd.RootCause;
        inv.CapaRef = cmd.CapaRef;
        inv.SignatureId = sig.SignatureId;
        inv.ClosedAt = DateTimeOffset.UtcNow;

        // Check if all OOS for this execution are now closed — if so, set execution Completed
        var allClosed = await _db.OosInvestigations
            .AllAsync(i => i.ExecutionId == inv.ExecutionId && i.Status == OosStatus.Closed, ct);
        if (allClosed)
        {
            inv.Execution.Status = TestExecutionStatus.Completed;
            inv.Execution.Sample.Status = SampleStatus.PendingQAReview;
            await _notify.PushToGroupAsync("QA", "OosClosedAllClear",
                new { executionId = inv.ExecutionId, sampleId = inv.Execution.SampleId }, ct);
        }

        await _db.SaveChangesAsync(ct);
        return Result<int>.Success(inv.InvestigationId);
    }
}
