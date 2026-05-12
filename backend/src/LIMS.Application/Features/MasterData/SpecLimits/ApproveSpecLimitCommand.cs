using FluentValidation;
using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using MediatR;

namespace LIMS.Application.Features.MasterData.SpecLimits;

public record ApproveSpecLimitCommand(int SpecLimitId, int UserId, string Password, string Meaning, string Reason) : IRequest<Result<int>>;

public class ApproveSpecLimitValidator : AbstractValidator<ApproveSpecLimitCommand>
{
    public ApproveSpecLimitValidator()
    {
        RuleFor(x => x.SpecLimitId).GreaterThan(0);
        RuleFor(x => x.UserId).GreaterThan(0);
        RuleFor(x => x.Password).NotEmpty();
        RuleFor(x => x.Meaning).NotEmpty();
        RuleFor(x => x.Reason).NotEmpty();
    }
}

public class ApproveSpecLimitHandler : IRequestHandler<ApproveSpecLimitCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IElectronicSignatureService _esig;
    private readonly IMasterDataAuditService _audit;
    private readonly INotificationService _notifications;

    public ApproveSpecLimitHandler(ILimsDbContext db, IElectronicSignatureService esig, IMasterDataAuditService audit, INotificationService notifications)
    { _db = db; _esig = esig; _audit = audit; _notifications = notifications; }

    public async Task<Result<int>> Handle(ApproveSpecLimitCommand request, CancellationToken cancellationToken)
    {
        var spec = await _db.SpecLimits.FindAsync([request.SpecLimitId], cancellationToken);
        if (spec is null) return Result<int>.Failure("NOT_FOUND", "Spec limit not found.");
        if (spec.Status != ApprovalStatus.Draft) return Result<int>.Failure("SPEC_LIMIT_LOCKED", "Approved spec limit cannot be edited. Create a new version.");

        var sig = await _esig.CreateSignatureAsync(request.UserId, request.Password, request.Meaning, request.Reason, "ApproveSpecLimit", cancellationToken);
        if (sig is null) return Result<int>.Failure("ESIGN_AUTH_FAILED", "Electronic signature failed — password incorrect. (21 CFR §11.300)");

        spec.Status = ApprovalStatus.Approved;
        spec.ApprovedBy = sig.FullName;
        spec.ApprovedAt = DateTimeOffset.UtcNow;
        spec.SignatureId = sig.SignatureId;

        await _db.SaveChangesAsync(cancellationToken);
        await _audit.LogAsync("SpecLimit", spec.SpecLimitId, "Approved", new { Status = "Draft" }, new { Status = "Approved", sig.FullName, sig.SignedAt }, sig.FullName, cancellationToken);
        await _notifications.PushToGroupAsync("QA", "SpecLimitApproved", new { spec.SpecLimitId }, cancellationToken);

        return Result<int>.Success(spec.SpecLimitId);
    }
}
