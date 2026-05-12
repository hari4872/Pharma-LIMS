using LIMS.Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.MasterData.Audit;

public record GetAuditLogsQuery(string EntityType, int EntityId) : IRequest<List<AuditLogDto>>;

public record AuditLogDto(long AuditId, string EntityType, int EntityId, string EventType,
    string? OldValue, string? NewValue, string PerformedBy, DateTimeOffset PerformedAt);

public class GetAuditLogsQueryHandler : IRequestHandler<GetAuditLogsQuery, List<AuditLogDto>>
{
    private readonly ILimsDbContext _db;
    public GetAuditLogsQueryHandler(ILimsDbContext db) => _db = db;

    public async Task<List<AuditLogDto>> Handle(GetAuditLogsQuery request, CancellationToken ct)
        => await _db.MasterDataAuditLogs
            .Where(a => a.EntityType == request.EntityType && a.EntityId == request.EntityId)
            .OrderByDescending(a => a.PerformedAt)
            .Select(a => new AuditLogDto(a.AuditId, a.EntityType, a.EntityId, a.EventType,
                a.OldValue, a.NewValue, a.PerformedBy, a.PerformedAt))
            .ToListAsync(ct);
}
