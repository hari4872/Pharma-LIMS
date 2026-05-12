using LIMS.Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.MasterData.LabConfigs;

public record GetLabConfigQuery(int LabId) : IRequest<List<LabConfigDto>>;

public record LabConfigDto(int ConfigId, int LabId, string ConfigKey, string ConfigValue,
    string UpdatedBy, DateTimeOffset UpdatedAt);

public class GetLabConfigQueryHandler : IRequestHandler<GetLabConfigQuery, List<LabConfigDto>>
{
    private readonly ILimsDbContext _db;
    public GetLabConfigQueryHandler(ILimsDbContext db) => _db = db;

    public async Task<List<LabConfigDto>> Handle(GetLabConfigQuery request, CancellationToken ct)
        => await _db.LabConfigs
            .Where(c => c.LabId == request.LabId)
            .Select(c => new LabConfigDto(c.ConfigId, c.LabId, c.ConfigKey, c.ConfigValue, c.UpdatedBy, c.UpdatedAt))
            .ToListAsync(ct);
}
