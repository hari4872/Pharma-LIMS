using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.SampleInventory;

// ── Get All Condition Excursions ────────────────────────────────
public record GetConditionExcursionsQuery(int? LocationId) : IRequest<List<ConditionExcursionDto>>;

public record ConditionExcursionDto(
    int ExcursionId, int LocationId, string LocationCode, string LocationName,
    string ExcursionType, decimal MeasuredValue, string LimitExceeded,
    DateTimeOffset ExcursionStart, DateTimeOffset? ExcursionEnd,
    string RecordedBy, DateTimeOffset RecordedAt,
    bool ImpactAssessed, string? ImpactOutcome, int AffectedSampleCount);

public class GetConditionExcursionsHandler : IRequestHandler<GetConditionExcursionsQuery, List<ConditionExcursionDto>>
{
    private readonly ILimsDbContext _db;
    public GetConditionExcursionsHandler(ILimsDbContext db) { _db = db; }

    public async Task<List<ConditionExcursionDto>> Handle(GetConditionExcursionsQuery req, CancellationToken ct)
    {
        var query = _db.ConditionExcursions
            .Include(e => e.Location)
            .Include(e => e.AffectedSamples)
            .AsNoTracking()
            .AsQueryable();

        if (req.LocationId.HasValue)
            query = query.Where(e => e.LocationId == req.LocationId.Value);

        var rows = await query.OrderByDescending(e => e.ExcursionStart).ToListAsync(ct);

        return rows.Select(e => new ConditionExcursionDto(
            e.ExcursionId, e.LocationId,
            e.Location?.LocationCode ?? string.Empty,
            e.Location?.LocationName ?? string.Empty,
            e.ExcursionType.ToString(), e.MeasuredValue, e.LimitExceeded,
            e.ExcursionStart, e.ExcursionEnd,
            e.RecordedBy, e.RecordedAt,
            e.ImpactAssessed, e.ImpactOutcome,
            e.AffectedSamples.Count
        )).ToList();
    }
}

// ── Log Condition Excursion ─────────────────────────────────────
// FR-13: ExcursionImpactService (Contract 1) called after insert
public record LogConditionExcursionCommand(
    int LocationId, string ExcursionType,
    decimal MeasuredValue, string LimitExceeded,
    DateTimeOffset ExcursionStart, DateTimeOffset? ExcursionEnd,
    string RecordedBy) : IRequest<Result<int>>;

public class LogConditionExcursionHandler : IRequestHandler<LogConditionExcursionCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IExcursionImpactService _impactService;

    public LogConditionExcursionHandler(ILimsDbContext db, IExcursionImpactService impactService)
    { _db = db; _impactService = impactService; }

    public async Task<Result<int>> Handle(LogConditionExcursionCommand req, CancellationToken ct)
    {
        var location = await _db.StorageLocations.FirstOrDefaultAsync(l => l.LocationId == req.LocationId && l.IsActive, ct);
        if (location is null) return Result<int>.Failure("NOT_FOUND", "Storage location not found or inactive.");

        if (!Enum.TryParse<ExcursionType>(req.ExcursionType, out var excType))
            return Result<int>.Failure("INVALID_TYPE", $"ExcursionType must be one of: {string.Join(", ", Enum.GetNames<ExcursionType>())}");

        if (req.LimitExceeded != "Min" && req.LimitExceeded != "Max")
            return Result<int>.Failure("INVALID_LIMIT", "LimitExceeded must be 'Min' or 'Max'.");

        var excursion = new ConditionExcursion
        {
            LocationId = req.LocationId,
            ExcursionType = excType,
            MeasuredValue = req.MeasuredValue,
            LimitExceeded = req.LimitExceeded,
            ExcursionStart = req.ExcursionStart,
            ExcursionEnd = req.ExcursionEnd,
            RecordedBy = req.RecordedBy,
            RecordedAt = DateTimeOffset.UtcNow
        };
        _db.ConditionExcursions.Add(excursion);
        await _db.SaveChangesAsync(ct);

        // Contract 1: ExcursionImpactService is the single place for impact assessment
        await _impactService.AssessImpactAsync(excursion.ExcursionId, ct);

        return Result<int>.Success(excursion.ExcursionId);
    }
}

// ── Complete Excursion Impact Assessment ────────────────────────
public record CompleteExcursionImpactCommand(int ExcursionId, string ImpactOutcome) : IRequest<Result<int>>;

public class CompleteExcursionImpactHandler : IRequestHandler<CompleteExcursionImpactCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    public CompleteExcursionImpactHandler(ILimsDbContext db) { _db = db; }

    public async Task<Result<int>> Handle(CompleteExcursionImpactCommand req, CancellationToken ct)
    {
        var ex = await _db.ConditionExcursions.FirstOrDefaultAsync(e => e.ExcursionId == req.ExcursionId, ct);
        if (ex is null) return Result<int>.Failure("NOT_FOUND", "Excursion not found.");
        ex.ImpactAssessed = true;
        ex.ImpactOutcome = req.ImpactOutcome;
        await _db.SaveChangesAsync(ct);
        return Result<int>.Success(ex.ExcursionId);
    }
}
