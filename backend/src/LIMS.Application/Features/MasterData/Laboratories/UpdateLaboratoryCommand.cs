using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.MasterData.Laboratories;

public record UpdateLaboratoryCommand(int LabId, string LabName, string Location, string LabType, string UpdatedBy) : IRequest<Result<int>>;

public class UpdateLaboratoryCommandValidator : AbstractValidator<UpdateLaboratoryCommand>
{
    public UpdateLaboratoryCommandValidator()
    {
        RuleFor(x => x.LabId).GreaterThan(0);
        RuleFor(x => x.LabName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Location).NotEmpty().MaximumLength(300);
        RuleFor(x => x.LabType).NotEmpty().Must(v => Enum.TryParse<LabType>(v, out _)).WithMessage("Invalid LabType.");
    }
}

public class UpdateLaboratoryCommandHandler : IRequestHandler<UpdateLaboratoryCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IMasterDataAuditService _audit;
    public UpdateLaboratoryCommandHandler(ILimsDbContext db, IMasterDataAuditService audit) { _db = db; _audit = audit; }

    public async Task<Result<int>> Handle(UpdateLaboratoryCommand request, CancellationToken ct)
    {
        var lab = await _db.Laboratories.FirstOrDefaultAsync(l => l.LabId == request.LabId, ct);
        if (lab is null) return Result<int>.Failure("NOT_FOUND", "Laboratory not found.");
        var old = new { lab.LabName, lab.Location, lab.LabType };
        lab.LabName = request.LabName; lab.Location = request.Location;
        lab.LabType = Enum.Parse<LabType>(request.LabType);
        await _db.SaveChangesAsync(ct);
        await _audit.LogAsync("Laboratory", lab.LabId, "Updated", old, new { lab.LabName, lab.Location, lab.LabType }, request.UpdatedBy);
        return Result<int>.Success(lab.LabId);
    }
}

public record DeactivateLaboratoryCommand(int LabId, string Reason, string UpdatedBy) : IRequest<Result<int>>;

public class DeactivateLaboratoryCommandHandler : IRequestHandler<DeactivateLaboratoryCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IMasterDataAuditService _audit;
    public DeactivateLaboratoryCommandHandler(ILimsDbContext db, IMasterDataAuditService audit) { _db = db; _audit = audit; }

    public async Task<Result<int>> Handle(DeactivateLaboratoryCommand request, CancellationToken ct)
    {
        var lab = await _db.Laboratories.FirstOrDefaultAsync(l => l.LabId == request.LabId, ct);
        if (lab is null) return Result<int>.Failure("NOT_FOUND", "Laboratory not found.");
        var old = new { lab.IsActive };
        lab.IsActive = false;
        await _db.SaveChangesAsync(ct);
        await _audit.LogAsync("Laboratory", lab.LabId, "Deactivated", old, new { IsActive = false, request.Reason }, request.UpdatedBy);
        return Result<int>.Success(lab.LabId);
    }
}
