using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Domain.Enums;
using FluentValidation;
using MediatR;

namespace LIMS.Application.Features.MasterData.Materials;

public record CreateMaterialCommand(string MaterialName, string Uom, string MaterialType,
    string? ProductType, int ShelfLifeDays, string CreatedBy) : IRequest<Result<int>>;

public class CreateMaterialCommandValidator : AbstractValidator<CreateMaterialCommand>
{
    public CreateMaterialCommandValidator()
    {
        RuleFor(x => x.MaterialName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Uom).NotEmpty().MaximumLength(30);
        RuleFor(x => x.MaterialType).NotEmpty()
            .Must(v => Enum.TryParse<MaterialType>(v, out _)).WithMessage("Invalid MaterialType.");
        RuleFor(x => x.ShelfLifeDays).GreaterThan(0);
    }
}

public class CreateMaterialCommandHandler : IRequestHandler<CreateMaterialCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IMasterDataAuditService _audit;
    public CreateMaterialCommandHandler(ILimsDbContext db, IMasterDataAuditService audit) { _db = db; _audit = audit; }

    public async Task<Result<int>> Handle(CreateMaterialCommand request, CancellationToken ct)
    {
        var material = new Material
        {
            MaterialName = request.MaterialName,
            Uom = request.Uom,
            MaterialType = Enum.Parse<MaterialType>(request.MaterialType),
            ProductType = request.ProductType,
            ShelfLifeDays = request.ShelfLifeDays,
            CreatedBy = request.CreatedBy,
            CreatedAt = DateTimeOffset.UtcNow
        };
        _db.Materials.Add(material);
        await _db.SaveChangesAsync(ct);
        await _audit.LogAsync("Material", material.MaterialId, "Created", null, material, request.CreatedBy);
        return Result<int>.Success(material.MaterialId);
    }
}
