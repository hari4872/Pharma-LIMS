using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.SampleInventory;

// ── Schedule Stability Pull ─────────────────────────────────────
// FR-02: due dates from T0 + time-points from DB (Contract 2 — no hardcoding)
public record ScheduleStabilityPullCommand(
    int SampleId, string TimePoint, DateOnly DueDate,
    decimal RequiredQty, string RequiredQtyUom) : IRequest<Result<int>>;

public class ScheduleStabilityPullHandler : IRequestHandler<ScheduleStabilityPullCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    public ScheduleStabilityPullHandler(ILimsDbContext db) { _db = db; }

    public async Task<Result<int>> Handle(ScheduleStabilityPullCommand req, CancellationToken ct)
    {
        if (!await _db.Samples.AnyAsync(s => s.SampleId == req.SampleId, ct))
            return Result<int>.Failure("SAMPLE_NOT_FOUND", "Sample not found.");

        if (await _db.StabilityPulls.AnyAsync(p => p.SampleId == req.SampleId && p.TimePoint == req.TimePoint, ct))
            return Result<int>.Failure("DUPLICATE_PULL", $"Pull for time-point '{req.TimePoint}' already scheduled for this sample.");

        var pull = new StabilityPull
        {
            SampleId = req.SampleId,
            TimePoint = req.TimePoint,
            DueDate = req.DueDate,
            RequiredQty = req.RequiredQty,
            RequiredQtyUom = req.RequiredQtyUom,
            Status = "Pending"
        };
        _db.StabilityPulls.Add(pull);
        await _db.SaveChangesAsync(ct);
        return Result<int>.Success(pull.PullId);
    }
}

// ── Execute Pull (via IPullExecutionService — Contract 1) ───────
public record ExecutePullCommand(
    int PullId, decimal ActualQty, string? ShortReason,
    int AnalystId, string Password, string Meaning) : IRequest<Result<PullExecutionResult>>;

public class ExecutePullHandler : IRequestHandler<ExecutePullCommand, Result<PullExecutionResult>>
{
    private readonly IPullExecutionService _pullService;
    public ExecutePullHandler(IPullExecutionService pullService) { _pullService = pullService; }

    public async Task<Result<PullExecutionResult>> Handle(ExecutePullCommand req, CancellationToken ct)
    {
        try
        {
            var result = await _pullService.ExecuteAsync(
                req.PullId, req.ActualQty, req.ShortReason ?? string.Empty,
                req.AnalystId, req.Password, req.Meaning, ct);
            return Result<PullExecutionResult>.Success(result);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Result<PullExecutionResult>.Failure("ESIGN_AUTH_FAILED", ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            return Result<PullExecutionResult>.Failure("INVALID_STATE", ex.Message);
        }
    }
}

// ── Get Stability Pulls ─────────────────────────────────────────
public record GetStabilityPullsQuery(int? SampleId, string? Status) : IRequest<IReadOnlyList<object>>;

public class GetStabilityPullsHandler : IRequestHandler<GetStabilityPullsQuery, IReadOnlyList<object>>
{
    private readonly ILimsDbContext _db;
    public GetStabilityPullsHandler(ILimsDbContext db) { _db = db; }

    public async Task<IReadOnlyList<object>> Handle(GetStabilityPullsQuery req, CancellationToken ct)
    {
        var query = _db.StabilityPulls
            .Include(p => p.Sample).ThenInclude(s => s.Material)
            .Include(p => p.ExecutedBy)
            .Include(p => p.ShortPullDeviations)
            .AsQueryable();

        if (req.SampleId.HasValue) query = query.Where(p => p.SampleId == req.SampleId.Value);
        if (!string.IsNullOrEmpty(req.Status)) query = query.Where(p => p.Status == req.Status);

        return await query.OrderBy(p => p.DueDate).Select(p => (object)new
        {
            p.PullId, p.SampleId, SampleNumber = p.Sample.SampleNumber,
            MaterialName = p.Sample.Material.MaterialName,
            p.TimePoint, p.DueDate, p.RequiredQty, p.RequiredQtyUom,
            p.Status, p.ActualQty, p.PulledAt,
            HasShortfall = p.ShortPullDeviations.Any(),
            ShortPullCount = p.ShortPullDeviations.Count
        }).ToListAsync(ct);
    }
}
