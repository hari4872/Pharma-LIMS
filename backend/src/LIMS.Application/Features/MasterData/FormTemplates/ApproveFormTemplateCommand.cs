using FluentValidation;
using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using MediatR;

namespace LIMS.Application.Features.MasterData.FormTemplates;

public record ApproveFormTemplateCommand(int FormTemplateId, int UserId, string Password, string Meaning, string Reason) : IRequest<Result<int>>;

public class ApproveFormTemplateValidator : AbstractValidator<ApproveFormTemplateCommand>
{
    public ApproveFormTemplateValidator()
    {
        RuleFor(x => x.FormTemplateId).GreaterThan(0);
        RuleFor(x => x.UserId).GreaterThan(0);
        RuleFor(x => x.Password).NotEmpty();
        RuleFor(x => x.Meaning).NotEmpty();
        RuleFor(x => x.Reason).NotEmpty();
    }
}

public class ApproveFormTemplateHandler : IRequestHandler<ApproveFormTemplateCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IElectronicSignatureService _esig;
    private readonly IMasterDataAuditService _audit;
    private readonly INotificationService _notifications;

    public ApproveFormTemplateHandler(ILimsDbContext db, IElectronicSignatureService esig, IMasterDataAuditService audit, INotificationService notifications)
    { _db = db; _esig = esig; _audit = audit; _notifications = notifications; }

    public async Task<Result<int>> Handle(ApproveFormTemplateCommand request, CancellationToken cancellationToken)
    {
        var template = await _db.FormTemplates.FindAsync([request.FormTemplateId], cancellationToken);
        if (template is null) return Result<int>.Failure("NOT_FOUND", "Form template not found.");
        if (template.Status != FormTemplateStatus.Draft)
            return Result<int>.Failure("FORM_TEMPLATE_INACTIVE", "Form Template is not in Draft status.");

        // §11.300: password independently verified
        var sig = await _esig.CreateSignatureAsync(request.UserId, request.Password, request.Meaning, request.Reason, "ApproveFormTemplate", cancellationToken);
        if (sig is null) return Result<int>.Failure("ESIGN_AUTH_FAILED", "Electronic signature failed — password incorrect. (21 CFR §11.300)");

        template.Status = FormTemplateStatus.Active;
        template.ApprovedBy = sig.FullName;
        template.ApprovedAt = DateTimeOffset.UtcNow;
        template.SignatureId = sig.SignatureId;

        await _db.SaveChangesAsync(cancellationToken);
        try { await _audit.LogAsync("FormTemplate", template.FormTemplateId, "Approved", new { Status = "Draft" }, new { Status = "Active", sig.FullName, sig.SignedAt }, sig.FullName, cancellationToken); } catch { /* non-critical */ }
        try { await _notifications.PushToGroupAsync("QA", "FormTemplateApproved", new { template.FormTemplateId, template.FormCode }, cancellationToken); } catch { /* non-critical */ }

        return Result<int>.Success(template.FormTemplateId);
    }
}
