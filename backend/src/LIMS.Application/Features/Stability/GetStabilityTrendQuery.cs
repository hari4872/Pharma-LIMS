using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.Stability;

public record GetStabilityTrendQuery(
    int ProtocolId,
    int ParameterId,
    StabilityStorageCondition? Condition = null) : IRequest<StabilityTrendReport>;

public record StabilityTrendReport(
    int ProtocolId,
    int ParameterId,
    string ParameterName,
    string ProtocolName,
    decimal? SpecMin,
    decimal? SpecMax,
    List<TrendTimePoint> TimePoints,
    double? RegressionSlope,
    double? RegressionIntercept,
    double? Mean,
    double? StdDev,
    double? PredictedShelfLifeMonths,   // months until value hits spec limit (linear extrapolation)
    TrendFlag Flag);

public record TrendTimePoint(
    int TimePointMonths,
    string Label,
    decimal MeasuredValue,
    DateTimeOffset MeasuredAt);

public class GetStabilityTrendHandler : IRequestHandler<GetStabilityTrendQuery, StabilityTrendReport>
{
    private readonly ILimsDbContext _db;
    public GetStabilityTrendHandler(ILimsDbContext db) => _db = db;

    public async Task<StabilityTrendReport> Handle(GetStabilityTrendQuery q, CancellationToken ct)
    {
        var points = await _db.StabilityTrendPoints
            .Include(p => p.Parameter)
            .Include(p => p.Protocol)
            .Include(p => p.Pull)
            .Where(p => p.ProtocolId == q.ProtocolId && p.ParameterId == q.ParameterId)
            .OrderBy(p => p.TimePointMonths)
            .ToListAsync(ct);

        if (q.Condition.HasValue)
            points = points.Where(p => p.StorageCondition == q.Condition.Value).ToList();

        var protocol  = points.FirstOrDefault()?.Protocol;
        var parameter = points.FirstOrDefault()?.Parameter;

        // Get spec limits for this parameter
        var specLimit = await _db.SpecLimits
            .Where(s => s.ParameterId == q.ParameterId && s.IsActive && s.Status == ApprovalStatus.Approved)
            .FirstOrDefaultAsync(ct);

        var timePoints = points.Select(p => new TrendTimePoint(
            p.TimePointMonths,
            $"T={p.TimePointMonths}M",
            p.MeasuredValue,
            p.CreatedAt)).ToList();

        if (timePoints.Count < 2)
        {
            return new StabilityTrendReport(
                q.ProtocolId, q.ParameterId,
                parameter?.ParameterName ?? "Unknown",
                protocol?.ProtocolName ?? "Unknown",
                specLimit?.MinValue, specLimit?.MaxValue,
                timePoints,
                null, null, null, null, null,
                TrendFlag.Stable);
        }

        // Linear regression — ICH Q1A statistical analysis
        var xs = timePoints.Select(p => (double)p.TimePointMonths).ToArray();
        var ys = timePoints.Select(p => (double)p.MeasuredValue).ToArray();
        var n  = xs.Length;

        var sumX  = xs.Sum();
        var sumY  = ys.Sum();
        var sumXY = xs.Zip(ys, (x, y) => x * y).Sum();
        var sumX2 = xs.Sum(x => x * x);

        var slope     = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        var intercept = (sumY - slope * sumX) / n;
        var mean      = ys.Average();
        var stdDev    = Math.Sqrt(ys.Sum(y => Math.Pow(y - mean, 2)) / (n - 1));

        // Predict months until spec breach (linear extrapolation)
        double? predictedShelfLife = null;
        if (specLimit is not null && Math.Abs(slope) > 0.0001)
        {
            // Which limit are we trending toward?
            if (slope < 0 && specLimit.MinValue.HasValue)
                predictedShelfLife = ((double)specLimit.MinValue.Value - intercept) / slope;
            else if (slope > 0 && specLimit.MaxValue.HasValue)
                predictedShelfLife = ((double)specLimit.MaxValue.Value - intercept) / slope;
        }

        // Flag based on predicted shelf life vs protocol duration
        var flag = TrendFlag.Stable;
        if (predictedShelfLife.HasValue && protocol is not null)
        {
            var remainingStudyMonths = protocol.StudyDurationMonths - xs.Max();
            if (predictedShelfLife.Value < xs.Max())
                flag = TrendFlag.ActionRequired;   // already breached projection
            else if (predictedShelfLife.Value < xs.Max() + remainingStudyMonths)
                flag = TrendFlag.WatchNeeded;      // will breach before end of study
        }

        return new StabilityTrendReport(
            q.ProtocolId, q.ParameterId,
            parameter?.ParameterName ?? "Unknown",
            protocol?.ProtocolName ?? "Unknown",
            specLimit?.MinValue, specLimit?.MaxValue,
            timePoints,
            Math.Round(slope, 4),
            Math.Round(intercept, 4),
            Math.Round(mean, 4),
            Math.Round(stdDev, 4),
            predictedShelfLife.HasValue ? Math.Round(predictedShelfLife.Value, 1) : null,
            flag);
    }
}
