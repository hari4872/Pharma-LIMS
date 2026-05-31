using LIMS.Application.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Infrastructure.Services;

/// <summary>
/// Levey-Jennings QC Chart Service
/// Groups logbook results by sample lot number and computes per-lot
/// mean ± 1σ/2σ/3σ bands. Applies Westgard rules:
///   1-2s: 1 point beyond ±2σ (warning)
///   1-3s: 1 point beyond ±3σ (rejection)
///   2-2s: 2 consecutive points beyond ±2σ same side (rejection)
///   R-4s: 1 point beyond +2σ AND next beyond -2σ (or vice versa) (rejection)
///   4-1s: 4 consecutive points beyond ±1σ same side (rejection)
///   10x:  10 consecutive points on same side of mean (rejection)
/// </summary>
public class QcChartService : IQcChartService
{
    private readonly ILimsDbContext _db;
    public QcChartService(ILimsDbContext db) => _db = db;

    public async Task<QcChartResult> GetChartAsync(int parameterId, int? labId, int? points, CancellationToken ct = default)
    {
        int window = Math.Min(points ?? 50, 200);

        var entries = await _db.DigitalLogbookEntries
            .Include(e => e.Execution).ThenInclude(ex => ex.Sample)
            .Where(e => e.ParameterId == parameterId
                     && e.CalculatedResult.HasValue
                     && (labId == null || e.Execution.Sample.LabId == labId))
            .OrderByDescending(e => e.CreatedAt)
            .Take(window)
            .ToListAsync(ct);

        var param = await _db.TestMethodParameters
            .FirstOrDefaultAsync(p => p.ParameterId == parameterId, ct);

        // Group by sample lot number — each lot is a separate QC series
        var byLot = entries
            .GroupBy(e => e.Execution.Sample.LotNumber)
            .OrderByDescending(g => g.Max(e => e.CreatedAt));

        var lots = new List<QcLotSeries>();

        foreach (var lotGroup in byLot)
        {
            var ordered = lotGroup.OrderBy(e => e.CreatedAt).ToList();
            if (ordered.Count < 2) continue;

            var values = ordered.Select(e => (double)e.CalculatedResult!.Value).ToArray();

            double mean   = values.Average();
            double stddev = Math.Sqrt(values.Select(v => Math.Pow(v - mean, 2)).Sum() / (values.Length - 1));
            if (stddev == 0) stddev = 0.0001;

            double s1 = stddev, s2 = 2 * stddev, s3 = 3 * stddev;

            // Assign sigma zone per point
            var qcPoints = ordered.Select(e =>
            {
                double val  = (double)e.CalculatedResult!.Value;
                double dist = Math.Abs(val - mean);
                int zone    = dist < s1 ? 0 : dist < s2 ? 1 : dist < s3 ? 2 : 3;
                return new QcPoint(e.Execution.Sample.SampleNumber, e.CreatedAt, Math.Round(val, 4), zone);
            }).ToArray();

            // Westgard rules
            var violations = new List<string>();

            // 1-3s: any point beyond ±3σ
            if (values.Any(v => Math.Abs(v - mean) > s3))
                violations.Add("1-3s: Point beyond ±3σ — rejection");

            // 1-2s: any point beyond ±2σ (warning only)
            if (violations.Count == 0 && values.Any(v => Math.Abs(v - mean) > s2))
                violations.Add("1-2s: Point beyond ±2σ — warning, check next result");

            // 2-2s: 2 consecutive beyond ±2σ same side
            for (int i = 0; i <= values.Length - 2; i++)
            {
                if (values[i] > mean + s2 && values[i + 1] > mean + s2) { violations.Add("2-2s: 2 consecutive above +2σ — rejection"); break; }
                if (values[i] < mean - s2 && values[i + 1] < mean - s2) { violations.Add("2-2s: 2 consecutive below -2σ — rejection"); break; }
            }

            // R-4s: range between 2 consecutive points > 4σ
            for (int i = 0; i <= values.Length - 2; i++)
            {
                if (Math.Abs(values[i] - values[i + 1]) > 4 * stddev)
                { violations.Add("R-4s: Range between 2 consecutive points > 4σ — rejection"); break; }
            }

            // 4-1s: 4 consecutive beyond ±1σ same side
            for (int i = 0; i <= values.Length - 4; i++)
            {
                var seg = values.Skip(i).Take(4).ToArray();
                if (seg.All(v => v > mean + s1)) { violations.Add("4-1s: 4 consecutive above +1σ — rejection"); break; }
                if (seg.All(v => v < mean - s1)) { violations.Add("4-1s: 4 consecutive below -1σ — rejection"); break; }
            }

            // 10x: 10 consecutive same side of mean
            if (values.Length >= 10)
            {
                for (int i = 0; i <= values.Length - 10; i++)
                {
                    var seg = values.Skip(i).Take(10).ToArray();
                    if (seg.All(v => v > mean) || seg.All(v => v < mean))
                    { violations.Add("10x: 10 consecutive points on same side of mean — rejection"); break; }
                }
            }

            lots.Add(new QcLotSeries(
                LotNumber:  lotGroup.Key,
                N:          values.Length,
                Mean:       Math.Round(mean, 4),
                Sigma:      Math.Round(s1, 4),
                Usl2:       Math.Round(mean + s2, 4),
                Lsl2:       Math.Round(mean - s2, 4),
                Usl3:       Math.Round(mean + s3, 4),
                Lsl3:       Math.Round(mean - s3, 4),
                Violations: violations.ToArray(),
                Points:     qcPoints));
        }

        return new QcChartResult(parameterId, param?.ParameterName ?? "Unknown", param?.Uom, lots.ToArray());
    }
}
