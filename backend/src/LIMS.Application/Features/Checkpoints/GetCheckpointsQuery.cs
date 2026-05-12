using LIMS.Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.Checkpoints;

public record GetCheckpointsQuery(int? LabId, string? TriggerMode) : IRequest<List<CheckpointDto>>;

public record CheckpointDto(
    int CheckpointId, string CheckpointCode, string TriggerMode,
    string CheckpointType, int? ShiftIntervalHrs, bool IsActive,
    int LocationCount);

public record GetProcessLogQuery(int CheckpointId, DateOnly? Date) : IRequest<List<ProcessLogRowDto>>;

public record ProcessLogRowDto(
    int RowId, DateTimeOffset SlotTime, string SlotLabel, string Status, bool IsSigned);

public class GetCheckpointsQueryHandler : IRequestHandler<GetCheckpointsQuery, List<CheckpointDto>>
{
    private readonly ILimsDbContext _db;
    public GetCheckpointsQueryHandler(ILimsDbContext db) => _db = db;

    public async Task<List<CheckpointDto>> Handle(GetCheckpointsQuery request, CancellationToken ct)
    {
        var query = _db.Checkpoints.Include(c => c.Locations).AsQueryable();
        if (request.LabId.HasValue) query = query.Where(c => c.LabId == request.LabId);
        if (!string.IsNullOrEmpty(request.TriggerMode)) query = query.Where(c => c.TriggerMode.ToString() == request.TriggerMode);
        return await query.Select(c => new CheckpointDto(
            c.CheckpointId, c.CheckpointCode, c.TriggerMode.ToString(),
            c.CheckpointType, c.ShiftIntervalHrs, c.IsActive, c.Locations.Count))
            .ToListAsync(ct);
    }
}

public class GetProcessLogQueryHandler : IRequestHandler<GetProcessLogQuery, List<ProcessLogRowDto>>
{
    private readonly ILimsDbContext _db;
    public GetProcessLogQueryHandler(ILimsDbContext db) => _db = db;

    public async Task<List<ProcessLogRowDto>> Handle(GetProcessLogQuery request, CancellationToken ct)
    {
        var query = _db.ProcessLogRows.Where(r => r.CheckpointId == request.CheckpointId);
        if (request.Date.HasValue)
        {
            var d = request.Date.Value.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
            query = query.Where(r => r.SlotTime >= d && r.SlotTime < d.AddDays(1));
        }
        return await query.OrderBy(r => r.SlotTime)
            .Select(r => new ProcessLogRowDto(r.RowId, r.SlotTime, r.SlotLabel, r.Status, r.SignatureId.HasValue))
            .ToListAsync(ct);
    }
}
