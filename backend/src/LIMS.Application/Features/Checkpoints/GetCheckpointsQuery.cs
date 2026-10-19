using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.Checkpoints;

public record GetCheckpointsQuery(int? LabId, string? TriggerMode, DateOnly? ViewDate = null) : IRequest<List<CheckpointDto>>;

public record CheckpointParameterDto(
    int ParameterId, string ParameterName, string ParameterCode, string? Uom, string DataType,
    decimal? AlertMin, decimal? AlertMax, decimal? ActionMin, decimal? ActionMax);

public record CheckpointDto(
    int CheckpointId, string CheckpointCode, string TriggerMode,
    string CheckpointType, int? ShiftIntervalHrs, bool IsActive,
    int LocationCount, string? TimeSlots, List<CheckpointParameterDto> Parameters,
    List<string> ExecutedTodaySlots,
    Dictionary<string, string> ExecutedSlotBreaches,   // slotLabel → "alert"|"action"
    string Category, string? SystemName, string? SystemCode, string? Location, string? SamplingPointCode, string LifecycleStatus, DateOnly? ScheduledDate);

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

        // Fetch executed rows + their readings for the requested date
        var targetDate = (request.ViewDate ?? DateOnly.FromDateTime(DateTime.UtcNow)).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var executedRows = await _db.ProcessLogRows
            .Where(r => r.SlotTime >= targetDate && r.SlotTime < targetDate.AddDays(1))
            .Include(r => r.Readings)
            .ToListAsync(ct);

        var executedDict = executedRows
            .GroupBy(r => r.CheckpointId)
            .ToDictionary(g => g.Key, g => g.Select(r => r.SlotLabel).ToList());

        // Compute worst breach per slot label per checkpoint (alert < action)
        var paramLimitsIndex = list.ToDictionary(
            c => c.CheckpointId,
            c => c.CheckpointParameters.ToDictionary(
                cp => cp.ParameterId,
                cp => (cp.AlertMin, cp.AlertMax, cp.ActionMin, cp.ActionMax)));

        var breachDict = new Dictionary<int, Dictionary<string, string>>();
        foreach (var row in executedRows)
        {
            if (!paramLimitsIndex.TryGetValue(row.CheckpointId, out var limits)) continue;
            string? worst = null;
            foreach (var reading in row.Readings)
            {
                if (!limits.TryGetValue(reading.ParameterId, out var lim)) continue;
                if (!decimal.TryParse(reading.Value, out var val)) continue;
                if ((lim.ActionMin.HasValue && val < lim.ActionMin) || (lim.ActionMax.HasValue && val > lim.ActionMax))
                { worst = "action"; break; }
                if ((lim.AlertMin.HasValue && val < lim.AlertMin) || (lim.AlertMax.HasValue && val > lim.AlertMax))
                    worst = "alert";
            }
            if (worst != null)
            {
                if (!breachDict.ContainsKey(row.CheckpointId))
                    breachDict[row.CheckpointId] = [];
                breachDict[row.CheckpointId][row.SlotLabel] = worst;
            }
        }

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
            executedDict.TryGetValue(c.CheckpointId, out var todaySlots) ? todaySlots : [],
            breachDict.TryGetValue(c.CheckpointId, out var breaches) ? breaches : [],
            c.Category, c.SystemName, c.SystemCode, c.Location, c.SamplingPointCode, c.LifecycleStatus, c.ScheduledDate))
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
