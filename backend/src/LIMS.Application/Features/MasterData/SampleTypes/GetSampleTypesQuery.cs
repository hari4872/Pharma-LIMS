using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.MasterData.SampleTypes;

public record GetSampleTypesQuery(bool IncludeInactive = false) : IRequest<List<SampleTypeDto>>;

public record SampleTypeDto(int SampleTypeId, string TypeName, string TypeCode,
    string Matrix, string Stage, string? Description, bool IsActive, string CreatedBy, DateTimeOffset CreatedAt);

public class GetSampleTypesQueryHandler : IRequestHandler<GetSampleTypesQuery, List<SampleTypeDto>>
{
    private readonly ILimsDbContext _db;
    public GetSampleTypesQueryHandler(ILimsDbContext db) => _db = db;

    public async Task<List<SampleTypeDto>> Handle(GetSampleTypesQuery request, CancellationToken ct)
    {
        var query = _db.SampleTypes.AsQueryable();
        if (!request.IncludeInactive) query = query.Where(s => s.IsActive);

        return await query.Select(s => new SampleTypeDto(
            s.SampleTypeId, s.TypeName, s.TypeCode,
            s.Matrix.ToString(), s.Stage.ToString(),
            s.Description, s.IsActive, s.CreatedBy, s.CreatedAt)).ToListAsync(ct);
    }
}
