using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.MasterData.Materials;

public record UpdateMaterialCommand(int MaterialId, string MaterialName, string Uom,
    string MaterialType, string? ProductType, int ShelfLifeDays, string UpdatedBy) : IRequest<Result<int>>;

public class UpdateMaterialCommandValidator : AbstractValidator<UpdateMaterialCommand>
{
    public UpdateMaterialCommandValidator()
    {
        RuleFor(x => x.MaterialId).GreaterThan(0);
        RuleFor(x => x.MaterialName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Uom).NotEmpty().MaximumLength(30);
        RuleFor(x => x.ShelfLifeDays).GreaterThan(0);
    }
}

public class UpdateMaterialCommandHandler : IRequestHandler<UpdateMaterialCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IMasterDataAuditService _audit;
    public UpdateMaterialCommandHandler(ILimsDbContext db, IMasterDataAuditService audit) { _db = db; _audit = audit; }

    public async Task<Result<int>> Handle(UpdateMaterialCommand request, CancellationToken ct)
    {
        var mat = await _db.Materials.FirstOrDefaultAsync(m => m.MaterialId == request.MaterialId, ct);
        if (mat is null) return Result<int>.Failure("NOT_FOUND", "Material not found.");
        var old = new { mat.MaterialName, mat.Uom, mat.MaterialType, mat.ShelfLifeDays };
        mat.MaterialName = request.MaterialName; mat.Uom = request.Uom;
        mat.MaterialType = Enum.Parse<MaterialType>(request.MaterialType);
        mat.ProductType = request.ProductType; mat.ShelfLifeDays = request.ShelfLifeDays;
        await _db.SaveChangesAsync(ct);
        await _audit.LogAsync("Material", mat.MaterialId, "Updated", old, new { mat.MaterialName, mat.Uom, mat.MaterialType, mat.ShelfLifeDays }, request.UpdatedBy);
        return Result<int>.Success(mat.MaterialId);
    }
}

public record DeactivateMaterialCommand(int MaterialId, string Reason, string UpdatedBy) : IRequest<Result<int>>;

public class DeactivateMaterialCommandHandler : IRequestHandler<DeactivateMaterialCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IMasterDataAuditService _audit;
    public DeactivateMaterialCommandHandler(ILimsDbContext db, IMasterDataAuditService audit) { _db = db; _audit = audit; }

    public async Task<Result<int>> Handle(DeactivateMaterialCommand request, CancellationToken ct)
    {
        var mat = await _db.Materials.FirstOrDefaultAsync(m => m.MaterialId == request.MaterialId, ct);
        if (mat is null) return Result<int>.Failure("NOT_FOUND", "Material not found.");
        mat.IsActive = false;
        await _db.SaveChangesAsync(ct);
        await _audit.LogAsync("Material", mat.MaterialId, "Deactivated", new { IsActive = true }, new { IsActive = false, request.Reason }, request.UpdatedBy);
        return Result<int>.Success(mat.MaterialId);
    }
}
