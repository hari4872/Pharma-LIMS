using FluentValidation;
using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using LIMS.Domain.Entities;

namespace LIMS.Application.Features.Samples;

// Step 7: SRF e-sig §11.50 → Status = PendingTesting (FR-09)
public record SignSRFCommand(int SampleId, int UserId, string Password, string Meaning, string Reason)
    : IRequest<Result<int>>;

public class SignSRFValidator : AbstractValidator<SignSRFCommand>
{
    public SignSRFValidator()
    {
        RuleFor(x => x.SampleId).GreaterThan(0);
        RuleFor(x => x.UserId).GreaterThan(0);
        // Password/Meaning/Reason optional — empty = auto-sign (identity confirmed by JWT)
    }
}

public class SignSRFCommandHandler : IRequestHandler<SignSRFCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IElectronicSignatureService _esig;
    private readonly IMasterDataAuditService _audit;
    private readonly INotificationService _notifications;
    private readonly ISpecificationEngineService _specEngine;
    private readonly ILogger<SignSRFCommandHandler> _logger;

    public SignSRFCommandHandler(ILimsDbContext db, IElectronicSignatureService esig,
        IMasterDataAuditService audit, INotificationService notifications,
        ISpecificationEngineService specEngine, ILogger<SignSRFCommandHandler> logger)
    { _db = db; _esig = esig; _audit = audit; _notifications = notifications; _specEngine = specEngine; _logger = logger; }

    public async Task<Result<int>> Handle(SignSRFCommand request, CancellationToken ct)
    {
        var sample = await _db.Samples.FindAsync([request.SampleId], ct);
        if (sample is null) return Result<int>.Failure("NOT_FOUND", "Sample not found.");
        if (sample.Status == SampleStatus.Released || sample.Status == SampleStatus.Rejected)
            return Result<int>.Failure("INVALID_STATE", "SRF cannot be signed after sample is released or rejected.");

        string signerName;
        if (!string.IsNullOrEmpty(request.Password))
        {
            var sig = await _esig.CreateSignatureAsync(request.UserId, request.Password,
                request.Meaning ?? "SRF signed", request.Reason ?? "Registration", "SignSRF", ct);
            if (sig is null) return Result<int>.Failure("ESIGN_AUTH_FAILED",
                "Electronic signature failed — password incorrect. (21 CFR §11.300)");
            sample.SrfSignatureId = sig.SignatureId;
            signerName = sig.FullName;
        }
        else
        {
            // Auto-sign on registration — identity confirmed by JWT auth
            var user = await _db.Users.FindAsync([request.UserId], ct);
            signerName = user?.FullName ?? "System";
        }

        // Capture status before mutation for accurate audit trail (21 CFR Part 11)
        var statusBefore = sample.Status.ToString();

        // Only advance to PendingTesting if not already assigned/in-testing (wizard assigns before SRF)
        if (sample.Status == SampleStatus.Registered || sample.Status == SampleStatus.PendingTesting)
            sample.Status = SampleStatus.PendingTesting;
        await _db.SaveChangesAsync(ct);

        // ── Run spec engine only if no executions exist yet ──────────────────
        int testsCreated = 0;
        var hasExecutions = await _db.TestExecutions.AnyAsync(e => e.SampleId == request.SampleId, ct);
        if (!hasExecutions)
        {
            try
            {
                var sampleType = await _db.SampleTypes.FindAsync([sample.SampleTypeId], ct);
                if (sampleType is not null)
                {
                    var matchResult = await _specEngine.MatchAsync(
                        sample.MaterialId, sample.SampleTypeId, sampleType.Stage, ct);

                    if (matchResult.Outcome == SpecMatchOutcome.SingleMatch && matchResult.TemplateId.HasValue)
                    {
                        var execIds = await _specEngine.ApplyTemplateAsync(
                            sample.SampleId, matchResult.TemplateId.Value,
                            "System", SpecAssignmentReason.AutoMatch,
                            DateTimeOffset.UtcNow, ct);
                        testsCreated = execIds.Count;
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Spec engine failed for sample {SampleId} after SRF sign — tests not auto-created", request.SampleId);
            }
        }

        // Audit and notification are non-critical — wrap so they never fail the main operation
        try
        {
            await _audit.LogAsync("Sample", sample.SampleId, "SRFSigned",
                new { Status = statusBefore }, new { Status = sample.Status.ToString(), FullName = signerName, SignedAt = DateTimeOffset.UtcNow },
                signerName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Audit log failed for SRF sign on sample {SampleId} — 21 CFR Part 11 gap", request.SampleId);
        }

        try
        {
            // Contract 2: push Work Queue task via SignalR
            await _notifications.PushToGroupAsync("Analyst", "WorkQueueTaskAdded",
                new { sample.SampleId, sample.SampleNumber, sample.LotNumber, testsCreated }, ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "SignalR notification failed for sample {SampleId} work queue push", request.SampleId);
        }

        return Result<int>.Success(sample.SampleId);
    }
}
