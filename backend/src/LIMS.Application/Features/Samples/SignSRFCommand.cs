using FluentValidation;
using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

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
        RuleFor(x => x.Password).NotEmpty();
        RuleFor(x => x.Meaning).NotEmpty();
        RuleFor(x => x.Reason).NotEmpty();
    }
}

public class SignSRFCommandHandler : IRequestHandler<SignSRFCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IElectronicSignatureService _esig;
    private readonly IMasterDataAuditService _audit;
    private readonly INotificationService _notifications;

    public SignSRFCommandHandler(ILimsDbContext db, IElectronicSignatureService esig,
        IMasterDataAuditService audit, INotificationService notifications)
    { _db = db; _esig = esig; _audit = audit; _notifications = notifications; }

    public async Task<Result<int>> Handle(SignSRFCommand request, CancellationToken ct)
    {
        var sample = await _db.Samples.FindAsync([request.SampleId], ct);
        if (sample is null) return Result<int>.Failure("NOT_FOUND", "Sample not found.");
        if (sample.Status != SampleStatus.Registered && sample.Status != SampleStatus.PendingTesting)
            return Result<int>.Failure("INVALID_STATE", "SRF can only be signed before testing begins.");

        // §11.300: password verified independently of session token
        var sig = await _esig.CreateSignatureAsync(request.UserId, request.Password,
            request.Meaning, request.Reason, "SignSRF", ct);
        if (sig is null) return Result<int>.Failure("ESIGN_AUTH_FAILED",
            "Electronic signature failed — password incorrect. (21 CFR §11.300)");

        sample.SrfSignatureId = sig.SignatureId;
        // Only advance status if still Registered — spec engine may have already set PendingTesting
        if (sample.Status == SampleStatus.Registered)
            sample.Status = SampleStatus.PendingTesting;
        await _db.SaveChangesAsync(ct);

        // Audit and notification are non-critical — wrap so they never fail the main operation
        try
        {
            await _audit.LogAsync("Sample", sample.SampleId, "SRFSigned",
                new { Status = "Registered" }, new { Status = "PendingTesting", sig.FullName, sig.SignedAt },
                sig.FullName);
        }
        catch { /* audit failure must not block SRF sign-off */ }

        try
        {
            // Contract 2: push Work Queue task via SignalR
            await _notifications.PushToGroupAsync("Analyst", "WorkQueueTaskAdded",
                new { sample.SampleId, sample.SampleNumber, sample.LotNumber }, ct);
        }
        catch { /* SignalR failure must not block SRF sign-off */ }

        return Result<int>.Success(sample.SampleId);
    }
}
