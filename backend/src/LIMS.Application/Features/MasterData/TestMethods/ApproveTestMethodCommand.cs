using FluentValidation;
using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.MasterData.TestMethods;

// 21 CFR §11.50: QA approves test method with e-sig
public record ApproveTestMethodCommand(int MethodId, int UserId, string Password, string Meaning, string Reason) : IRequest<Result<int>>;

public class ApproveTestMethodValidator : AbstractValidator<ApproveTestMethodCommand>
{
    public ApproveTestMethodValidator()
    {
        RuleFor(x => x.MethodId).GreaterThan(0);
        RuleFor(x => x.UserId).GreaterThan(0);
        RuleFor(x => x.Password).NotEmpty();
        RuleFor(x => x.Meaning).NotEmpty();
        RuleFor(x => x.Reason).NotEmpty();
    }
}

public class ApproveTestMethodHandler : IRequestHandler<ApproveTestMethodCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IElectronicSignatureService _esig;
    private readonly IMasterDataAuditService _audit;
    private readonly INotificationService _notifications;

    public ApproveTestMethodHandler(ILimsDbContext db, IElectronicSignatureService esig, IMasterDataAuditService audit, INotificationService notifications)
    {
        _db = db; _esig = esig; _audit = audit; _notifications = notifications;
    }

    public async Task<Result<int>> Handle(ApproveTestMethodCommand request, CancellationToken cancellationToken)
    {
        var method = await _db.TestMethods.FindAsync([request.MethodId], cancellationToken);
        if (method is null) return Result<int>.Failure("NOT_FOUND", "Test method not found.");
        if (method.Status != ApprovalStatus.Draft) return Result<int>.Failure("SPEC_LIMIT_LOCKED", "Only Draft methods can be approved.");

        // §11.300: password verified independently of session token
        var sig = await _esig.CreateSignatureAsync(request.UserId, request.Password, request.Meaning, request.Reason, "ApproveTestMethod", cancellationToken);
        if (sig is null) return Result<int>.Failure("ESIGN_AUTH_FAILED", "Electronic signature failed — password incorrect. (21 CFR §11.300)");

        var oldStatus = method.Status;
        method.Status = ApprovalStatus.Approved;
        method.ApprovedBy = sig.FullName;
        method.ApprovedAt = DateTimeOffset.UtcNow;  // Contract 2: UTC server-side
        method.SignatureId = sig.SignatureId;

        await _db.SaveChangesAsync(cancellationToken);
        try { await _audit.LogAsync("TestMethod", method.MethodId, "Approved", new { Status = oldStatus.ToString() }, new { Status = "Approved", sig.FullName, sig.SignedAt }, sig.FullName, cancellationToken); } catch { /* non-critical */ }
        try { await _notifications.PushToGroupAsync("QA", "TestMethodApproved", new { method.MethodId, method.MethodCode, method.MethodName }, cancellationToken); } catch { /* non-critical */ }

        return Result<int>.Success(method.MethodId);
    }
}
