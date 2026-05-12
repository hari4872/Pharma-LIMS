using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.MasterData.Laboratories;

public record GetLaboratoriesQuery(bool IncludeInactive = false) : IRequest<List<LaboratoryDto>>;

public record LaboratoryDto(int LabId, string LabName, string Location, string LabType, bool IsActive, string CreatedBy, DateTimeOffset CreatedAt);

public class GetLaboratoriesHandler : IRequestHandler<GetLaboratoriesQuery, List<LaboratoryDto>>
{
    private readonly ILimsDbContext _db;
    public GetLaboratoriesHandler(ILimsDbContext db) => _db = db;

    public async Task<List<LaboratoryDto>> Handle(GetLaboratoriesQuery request, CancellationToken cancellationToken)
    {
        var query = _db.Laboratories.AsQueryable();
        if (!request.IncludeInactive)
            query = query.Where(l => l.IsActive);

        return await query
            .OrderBy(l => l.LabName)
            .Select(l => new LaboratoryDto(l.LabId, l.LabName, l.Location, l.LabType.ToString(), l.IsActive, l.CreatedBy, l.CreatedAt))
            .ToListAsync(cancellationToken);
    }
}
