using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.MasterData.Materials;

public record GetMaterialsQuery(string? MaterialType, bool IncludeInactive = false) : IRequest<List<MaterialDto>>;

public record MaterialDto(int MaterialId, string MaterialName, string Uom, string MaterialType,
    string? ProductType, int ShelfLifeDays, bool IsActive, string CreatedBy, DateTimeOffset CreatedAt);

public class GetMaterialsQueryHandler : IRequestHandler<GetMaterialsQuery, List<MaterialDto>>
{
    private readonly ILimsDbContext _db;
    public GetMaterialsQueryHandler(ILimsDbContext db) => _db = db;

    public async Task<List<MaterialDto>> Handle(GetMaterialsQuery request, CancellationToken ct)
    {
        var query = _db.Materials.AsQueryable();
        if (!request.IncludeInactive) query = query.Where(m => m.IsActive);
        if (!string.IsNullOrEmpty(request.MaterialType) && Enum.TryParse<MaterialType>(request.MaterialType, out var mt))
            query = query.Where(m => m.MaterialType == mt);

        return await query.Select(m => new MaterialDto(
            m.MaterialId, m.MaterialName, m.Uom,
            m.MaterialType.ToString(), m.ProductType, m.ShelfLifeDays, m.IsActive,
            m.CreatedBy, m.CreatedAt)).ToListAsync(ct);
    }
}
