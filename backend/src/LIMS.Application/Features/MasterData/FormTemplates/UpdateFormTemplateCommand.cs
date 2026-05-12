using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.MasterData.FormTemplates;

public record UpdateFormTemplateCommand(int FormTemplateId, string FormName,
    string TriggerType, bool EvidenceMandatory, string? RegulatoryTier, string UpdatedBy) : IRequest<Result<int>>;

public class UpdateFormTemplateCommandHandler : IRequestHandler<UpdateFormTemplateCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IMasterDataAuditService _audit;
    public UpdateFormTemplateCommandHandler(ILimsDbContext db, IMasterDataAuditService audit) { _db = db; _audit = audit; }

    public async Task<Result<int>> Handle(UpdateFormTemplateCommand request, CancellationToken ct)
    {
        var ft = await _db.FormTemplates.FirstOrDefaultAsync(f => f.FormTemplateId == request.FormTemplateId, ct);
        if (ft is null) return Result<int>.Failure("NOT_FOUND", "Form template not found.");

        var parts = ft.Version.Split('.');
        var newVersion = parts.Length == 2 ? $"{parts[0]}.{int.Parse(parts[1]) + 1}" : $"{ft.Version}.1";

        var old = new { ft.FormName, ft.TriggerType, ft.EvidenceMandatory, ft.Version };
        ft.FormName = request.FormName;
        ft.TriggerType = Enum.Parse<TriggerType>(request.TriggerType);
        ft.EvidenceMandatory = request.EvidenceMandatory;
        ft.RegulatoryTier = request.RegulatoryTier;
        ft.Version = newVersion; ft.Status = FormTemplateStatus.Draft;
        ft.SignatureId = null; ft.ApprovedBy = null; ft.ApprovedAt = null;
        await _db.SaveChangesAsync(ct);
        await _audit.LogAsync("FormTemplate", ft.FormTemplateId, "Updated", old,
            new { ft.FormName, ft.Version, status = "Draft" }, request.UpdatedBy);
        return Result<int>.Success(ft.FormTemplateId);
    }
}

public record DeactivateFormTemplateCommand(int FormTemplateId, string Reason, string UpdatedBy) : IRequest<Result<int>>;

public class DeactivateFormTemplateCommandHandler : IRequestHandler<DeactivateFormTemplateCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IMasterDataAuditService _audit;
    public DeactivateFormTemplateCommandHandler(ILimsDbContext db, IMasterDataAuditService audit) { _db = db; _audit = audit; }

    public async Task<Result<int>> Handle(DeactivateFormTemplateCommand request, CancellationToken ct)
    {
        var ft = await _db.FormTemplates.FirstOrDefaultAsync(f => f.FormTemplateId == request.FormTemplateId, ct);
        if (ft is null) return Result<int>.Failure("NOT_FOUND", "Form template not found.");
        ft.IsActive = false; ft.Status = FormTemplateStatus.Retired;
        await _db.SaveChangesAsync(ct);
        await _audit.LogAsync("FormTemplate", ft.FormTemplateId, "Deactivated",
            new { IsActive = true }, new { IsActive = false, request.Reason }, request.UpdatedBy);
        return Result<int>.Success(ft.FormTemplateId);
    }
}
