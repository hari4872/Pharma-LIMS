using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.OosInvestigations;

/// <summary>
/// Sprint 1 — OOS Phase 2 Escalation (FDA OOS Guidance step 2)
/// QA/QCLead escalates Phase 1 investigation to Phase 2 (independent lab investigation)
/// Records: escalation reason, CAPA reference, who escalated, §11.50 e-signature
/// </summary>
public record EscalateToPhase2Command(
    int InvestigationId,
    int UserId,
    string EscalationReason,
    string? CapaRef,
    string Password,
    string Meaning,
    string Reason) : IRequest<Result<int>>;

public class EscalateToPhase2Handler : IRequestHandler<EscalateToPhase2Command, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IElectronicSignatureService _esig;
    private readonly INotificationService _notify;
    private readonly IMasterDataAuditService _audit;

    public EscalateToPhase2Handler(ILimsDbContext db, IElectronicSignatureService esig, INotificationService notify, IMasterDataAuditService audit)
    { _db = db; _esig = esig; _notify = notify; _audit = audit; }

    public async Task<Result<int>> Handle(EscalateToPhase2Command cmd, CancellationToken ct)
    {
        var inv = await _db.OosInvestigations
            .Include(i => i.Execution).ThenInclude(e => e.Sample)
            .FirstOrDefaultAsync(i => i.InvestigationId == cmd.InvestigationId, ct);

        if (inv is null) return Result<int>.Failure("NOT_FOUND", "Investigation not found.");
        if (inv.Execution?.Sample is null)
            return Result<int>.Failure("DATA_ERROR", "Execution or sample data could not be loaded.");
        if (inv.Status == OosStatus.Closed)
            return Result<int>.Failure("ALREADY_CLOSED", "Cannot escalate a closed investigation.");
        if (inv.Phase == OosPhase.Phase2)
            return Result<int>.Failure("ALREADY_PHASE2", "Investigation is already in Phase 2.");

        // §11.50 e-signature required for Phase 2 escalation (FDA OOS Guidance)
        var sig = await _esig.CreateSignatureAsync(
            cmd.UserId, cmd.Password, cmd.Meaning, cmd.Reason,
            "OosInvestigation.Phase2Escalation", ct);
        if (sig is null)
            return Result<int>.Failure("ESIGN_AUTH_FAILED", "Password incorrect — e-signature rejected. (21 CFR §11.300)");

        inv.Phase = OosPhase.Phase2;
        inv.RootCause = string.IsNullOrWhiteSpace(inv.RootCause)
            ? $"[Phase 2 Escalation] {cmd.EscalationReason}"
            : $"{inv.RootCause} | [Phase 2 Escalation] {cmd.EscalationReason}";

        if (!string.IsNullOrWhiteSpace(cmd.CapaRef))
            inv.CapaRef = cmd.CapaRef;

        var sampleNo = inv.Execution.Sample.SampleNumber;
        await _db.SaveChangesAsync(ct);

        // Push real-time alerts after successful save — prevents phantom notifications on DB failure
        await _notify.PushToGroupAsync("LabManager", "OosPhase2Escalated",
            new { investigationId = inv.InvestigationId, sampleNumber = sampleNo, reason = cmd.EscalationReason }, ct);
        await _notify.PushToGroupAsync("QA", "OosPhase2Escalated",
            new { investigationId = inv.InvestigationId, sampleNumber = sampleNo, reason = cmd.EscalationReason }, ct);
        await _audit.LogAsync("OosInvestigation", inv.InvestigationId, "EscalatedToPhase2",
            new { Phase = "Phase1", Status = inv.Status.ToString() },
            new { Phase = "Phase2", EscalationReason = cmd.EscalationReason, inv.CapaRef },
            inv.Execution?.Sample?.SampleNumber ?? "Unknown");
        return Result<int>.Success(inv.InvestigationId);
    }
}
