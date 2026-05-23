using LIMS.Application.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Infrastructure.Services;

public class StabilityTrendService : IStabilityTrendService
{
    private readonly ILimsDbContext _db;
    public StabilityTrendService(ILimsDbContext db) => _db = db;

    public async Task<StabilityTrendResult> GetTrendDataAsync(int protocolId, int? parameterId, CancellationToken ct = default)
    {
        var protocol = await _db.StabilityProtocols
            .Include(p => p.Intervals.OrderBy(i => i.MonthOffset))
            .Include(p => p.Material)
            .FirstOrDefaultAsync(p => p.StabilityProtocolId == protocolId, ct)
            ?? throw new KeyNotFoundException($"StabilityProtocol {protocolId} not found");

        // Find all pulls for samples linked to this protocol's material
        var pulls = await _db.StabilityPulls
            .Include(p => p.Sample)
            .Where(p => p.Sample.MaterialId == protocol.MaterialId && p.Status == "Pulled")
            .OrderBy(p => p.PulledAt)
            .ToListAsync(ct);

        if (!pulls.Any())
            return new StabilityTrendResult(protocolId, protocol.ProtocolName,
                protocol.StorageCondition.ToString(), protocol.StudyDurationMonths,
                protocol.IntendedShelfLifeMonths, []);

        var sampleIds = pulls.Select(p => p.SampleId).Distinct().ToList();

        // Get logbook entries for those samples
        var entries = await _db.DigitalLogbookEntries
            .Include(e => e.Execution)
            .Include(e => e.Parameter)
            .Where(e => sampleIds.Contains(e.SampleId)
                     && e.CalculatedResult.HasValue
                     && (parameterId == null || e.ParameterId == parameterId))
            .ToListAsync(ct);

        // Group by parameter
        var paramGroups = entries.GroupBy(e => e.ParameterId).ToList();
        var trendParams = new List<TrendParameter>();

        foreach (var pg in paramGroups)
        {
            var param = pg.First().Parameter;
            var specLimit = await _db.SpecLimits
                .FirstOrDefaultAsync(s => s.MaterialId == protocol.MaterialId && s.ParameterId == pg.Key, ct);

            // Build data points: correlate entry with pull time point
            var dataPoints = new List<TrendDataPoint>();
            foreach (var entry in pg.Where(e => e.CalculatedResult.HasValue))
            {
                var pull = pulls.FirstOrDefault(p => p.SampleId == entry.SampleId);
                if (pull is null) continue;

                // Parse month offset from TimePoint string (e.g. "T3M" → 3, "T0" → 0)
                int monthOffset = ParseMonthOffset(pull.TimePoint);
                dataPoints.Add(new TrendDataPoint(
                    monthOffset,
                    pull.TimePoint,
                    (double)entry.CalculatedResult!.Value,
                    entry.IsOos,
                    entry.Execution?.Sample?.SampleNumber ?? "",
                    pull.PulledAt ?? pull.CreatedAt
                ));
            }

            dataPoints = dataPoints.OrderBy(d => d.MonthOffset).ToList();

            // Linear regression for shelf-life prediction
            double? predictedShelfLife = null;
            double? rSquared = null;
            if (dataPoints.Count >= 3 && specLimit != null)
            {
                var (slope, intercept, r2) = LinearRegression(
                    dataPoints.Select(d => (double)d.MonthOffset).ToList(),
                    dataPoints.Select(d => d.Value).ToList());
                rSquared = Math.Round(r2, 4);

                // Predict where value crosses spec limit
                if (Math.Abs(slope) > 0.0001)
                {
                    double limitToUse = slope < 0 ? (double)(specLimit.MinValue ?? 0) : (double)(specLimit.MaxValue ?? 999);
                    predictedShelfLife = Math.Round((limitToUse - intercept) / slope, 1);
                    if (predictedShelfLife < 0) predictedShelfLife = null; // already out of spec at T=0
                }
            }

            trendParams.Add(new TrendParameter(
                pg.Key, param.ParameterName, param.Uom,
                specLimit != null ? (double?)specLimit.MinValue : null,
                specLimit != null ? (double?)specLimit.MaxValue : null,
                predictedShelfLife, rSquared, dataPoints));
        }

        return new StabilityTrendResult(protocolId, protocol.ProtocolName,
            protocol.StorageCondition.ToString(), protocol.StudyDurationMonths,
            protocol.IntendedShelfLifeMonths, trendParams);
    }

    public async Task<IchComplianceResult> GetIchComplianceAsync(int protocolId, CancellationToken ct = default)
    {
        var protocol = await _db.StabilityProtocols
            .Include(p => p.Intervals.OrderBy(i => i.MonthOffset))
            .FirstOrDefaultAsync(p => p.StabilityProtocolId == protocolId, ct)
            ?? throw new KeyNotFoundException($"StabilityProtocol {protocolId} not found");

        var pulls = await _db.StabilityPulls
            .Include(p => p.Sample)
            .Where(p => p.Sample.MaterialId == protocol.MaterialId)
            .ToListAsync(ct);

        var intervalStatuses = protocol.Intervals.Select(interval => {
            // Match pull to interval by time point label or month offset
            var matchedPull = pulls.FirstOrDefault(p =>
                ParseMonthOffset(p.TimePoint) == interval.MonthOffset);
            return new IchIntervalStatus(
                interval.MonthOffset,
                interval.Label,
                interval.IsMandatory,
                matchedPull != null && matchedPull.Status == "Pulled",
                matchedPull?.PullId,
                matchedPull?.Status ?? "NotScheduled",
                matchedPull?.PulledAt
            );
        }).ToList();

        return new IchComplianceResult(protocolId, protocol.StorageCondition.ToString(), intervalStatuses);
    }

    private static int ParseMonthOffset(string timePoint)
    {
        // "T0" → 0, "T3M" → 3, "T6M" → 6, "T12M" → 12, "T1M" → 1
        timePoint = timePoint.TrimStart('T').TrimEnd('M');
        return int.TryParse(timePoint, out var m) ? m : 0;
    }

    private static (double slope, double intercept, double r2) LinearRegression(List<double> x, List<double> y)
    {
        int n = x.Count;
        double sumX = x.Sum(), sumY = y.Sum();
        double sumXY = x.Zip(y, (a, b) => a * b).Sum();
        double sumX2 = x.Select(a => a * a).Sum();
        double denom = n * sumX2 - sumX * sumX;
        if (Math.Abs(denom) < 1e-10) return (0, sumY / n, 0);
        double slope = (n * sumXY - sumX * sumY) / denom;
        double intercept = (sumY - slope * sumX) / n;
        double yMean = sumY / n;
        double ssTot = y.Select(yi => Math.Pow(yi - yMean, 2)).Sum();
        double ssRes = x.Zip(y, (xi, yi) => Math.Pow(yi - (slope * xi + intercept), 2)).Sum();
        double r2 = ssTot < 1e-10 ? 1 : 1 - ssRes / ssTot;
        return (slope, intercept, r2);
    }
}
