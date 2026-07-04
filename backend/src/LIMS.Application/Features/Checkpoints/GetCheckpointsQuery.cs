using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.Checkpoints;

public record GetCheckpointsQuery(int? LabId, string? TriggerMode) : IRequest<List<CheckpointDto>>;

public record CheckpointParameterDto(
    int ParameterId, string ParameterName, string ParameterCode, string? Uom, string DataType,
    decimal? AlertMin, decimal? AlertMax, decimal? ActionMin, decimal? ActionMax);

public record CheckpointDto(
    int CheckpointId, string CheckpointCode, string TriggerMode,
    string CheckpointType, int? ShiftIntervalHrs, bool IsActive,
    int LocationCount, string? TimeSlots, List<CheckpointParameterDto> Parameters,
    List<string> ExecutedTodaySlots);

public record GetProcessLogQuery(int CheckpointId, DateOnly? Date) : IRequest<List<ProcessLogRowDto>>;

public record ProcessLogReadingDto(int ReadingId, int ParameterId, string ParameterName, string ParameterCode, string? Uom, string Value);

public record ProcessLogRowDto(
    int RowId, DateTimeOffset SlotTime, string SlotLabel, string Status, bool IsSigned,
    int? SampleId, string? SampleNumber,
    List<ProcessLogReadingDto> Readings);

public class GetCheckpointsQueryHandler : IRequestHandler<GetCheckpointsQuery, List<CheckpointDto>>
{
    private readonly ILimsDbContext _db;
    public GetCheckpointsQueryHandler(ILimsDbContext db) => _db = db;

    public async Task<List<CheckpointDto>> Handle(GetCheckpointsQuery request, CancellationToken ct)
    {
        var query = _db.Checkpoints
            .Include(c => c.Locations)
            .Include(c => c.CheckpointParameters).ThenInclude(cp => cp.Parameter)
            .AsQueryable();
        if (request.LabId.HasValue) query = query.Where(c => c.LabId == request.LabId);
        if (!string.IsNullOrEmpty(request.TriggerMode) && Enum.TryParse<TriggerType>(request.TriggerMode, true, out var triggerEnum))
            query = query.Where(c => c.TriggerMode == triggerEnum);
        var list = await query.ToListAsync(ct);

        // Fetch today's already-executed slot labels per checkpoint (UTC day)
        // GroupBy done in memory — EF Core cannot translate .ToList() inside GroupBy to SQL
        var todayUtc = DateOnly.FromDateTime(DateTime.UtcNow).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var executedRows = await _db.ProcessLogRows
            .Where(r => r.SlotTime >= todayUtc && r.SlotTime < todayUtc.AddDays(1))
            .Select(r => new { r.CheckpointId, r.SlotLabel })
            .ToListAsync(ct);
        var executedDict = executedRows
            .GroupBy(r => r.CheckpointId)
            .ToDictionary(g => g.Key, g => g.Select(r => r.SlotLabel).ToList());

        return list.Select(c => new CheckpointDto(
            c.CheckpointId, c.CheckpointCode, c.TriggerMode.ToString(),
            c.CheckpointType, c.ShiftIntervalHrs, c.IsActive, c.Locations.Count,
            c.TimeSlots,
            c.CheckpointParameters
                .Where(cp => cp.Parameter != null)
                .Select(cp => new CheckpointParameterDto(
                cp.Parameter.ParameterId, cp.Parameter.ParameterName,
                cp.Parameter.ParameterCode, cp.Parameter.Uom,
                cp.Parameter.DataType.ToString(),
                cp.AlertMin, cp.AlertMax, cp.ActionMin, cp.ActionMax)).ToList(),
            executedDict.TryGetValue(c.CheckpointId, out var todaySlots) ? todaySlots : []))
            .ToList();
    }
}

// GET all process log rows across ALL checkpoints for a given date — for Digital Logbook tab
public record GetAllProcessLogQuery(DateOnly? Date) : IRequest<List<AllProcessLogRowDto>>;

public record AllProcessLogRowDto(
    int RowId, int CheckpointId, string CheckpointCode, string TriggerMode,
    DateTimeOffset SlotTime, string SlotLabel, string Status, bool IsSigned,
    int? SampleId, string? SampleNumber,
    List<ProcessLogReadingDto> Readings);

public class GetAllProcessLogQueryHandler : IRequestHandler<GetAllProcessLogQuery, List<AllProcessLogRowDto>>
{
    private readonly ILimsDbContext _db;
    public GetAllProcessLogQueryHandler(ILimsDbContext db) => _db = db;

    public async Task<List<AllProcessLogRowDto>> Handle(GetAllProcessLogQuery request, CancellationToken ct)
    {
        var query = _db.ProcessLogRows.Include(r => r.Checkpoint).AsQueryable();

        // Only return rows from ProcessLog-type checkpoints (shift sign-offs).
        // TimeBased, OperatorScan and DispatchEvent checkpoints are recorded via
        // Test Executions (Digital Logbook → Test Results tab), not here.
        query = query.Where(r => r.Checkpoint.TriggerMode == TriggerType.ProcessLog);

        if (request.Date.HasValue)
        {
            var d = request.Date.Value.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
            query = query.Where(r => r.SlotTime >= d && r.SlotTime < d.AddDays(1));
        }
        else
        {
            // Default: today
            var today = DateOnly.FromDateTime(DateTime.UtcNow).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
            query = query.Where(r => r.SlotTime >= today && r.SlotTime < today.AddDays(1));
        }
        var rows = await query
            .Include(r => r.Readings).ThenInclude(rd => rd.Parameter)
            .Include(r => r.Sample)
            .OrderBy(r => r.SlotTime).ToListAsync(ct);
        return rows.Select(r => new AllProcessLogRowDto(
            r.RowId, r.CheckpointId, r.Checkpoint.CheckpointCode, r.Checkpoint.TriggerMode.ToString(),
            r.SlotTime, r.SlotLabel, r.Status, r.SignatureId.HasValue,
            r.SampleId, r.Sample?.SampleNumber,
            r.Readings.Where(rd => rd.Parameter != null).Select(rd => new ProcessLogReadingDto(
                rd.ReadingId, rd.ParameterId, rd.Parameter.ParameterName,
                rd.Parameter.ParameterCode, rd.Parameter.Uom, rd.Value)).ToList()))
            .ToList();
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
        var rows = await query
            .Include(r => r.Readings).ThenInclude(rd => rd.Parameter)
            .Include(r => r.Sample)
            .OrderBy(r => r.SlotTime).ToListAsync(ct);
        return rows.Select(r => new ProcessLogRowDto(
            r.RowId, r.SlotTime, r.SlotLabel, r.Status, r.SignatureId.HasValue,
            r.SampleId, r.Sample?.SampleNumber,
            r.Readings.Where(rd => rd.Parameter != null).Select(rd => new ProcessLogReadingDto(
                rd.ReadingId, rd.ParameterId, rd.Parameter.ParameterName,
                rd.Parameter.ParameterCode, rd.Parameter.Uom, rd.Value)).ToList()))
            .ToList();
    }
}
