using LIMS.Application.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Infrastructure.Services;

/// <summary>
/// Sprint 5 — Statistical Process Control (SPC) Service
/// Calculates control limits, Cp/Cpk, and detects Nelson rule violations.
///
/// Algorithm:
///   Mean (X̄)  = Σxi / n
///   Stddev (σ) = sqrt(Σ(xi − X̄)² / (n−1))  [sample std-dev, Bessel correction]
///   UCL / LCL  = X̄ ± 3σ
///   Cp         = (USL − LSL) / (6σ)
///   Cpk        = min((USL − X̄) / (3σ), (X̄ − LSL) / (3σ))
///
/// Nelson rules checked (rules 1 & 2 as minimum):
///   Rule 1: Any point beyond ±3σ (OOC)
///   Rule 2: 9 consecutive points on same side of mean (shift)
///   Rule 3: 6 consecutive points steadily increasing or decreasing (trend)
/// </summary>
public class SpcService : ISpcService
{
    private readonly ILimsDbContext _db;
    public SpcService(ILimsDbContext db) => _db = db;

    public async Task<SpcResult> CalculateAsync(int parameterId, int? labId, int? points, CancellationToken ct = default)
    {
        int window = Math.Min(points ?? 50, 200);

        // Fetch the last N signed logbook entries for this parameter
        var entries = await _db.DigitalLogbookEntries
            .Include(e => e.Execution).ThenInclude(ex => ex.Sample)
            .Where(e => e.ParameterId == parameterId
                     && e.CalculatedResult.HasValue
                     && (labId == null || e.Execution.Sample.LabId == labId))
            .OrderByDescending(e => e.CreatedAt)
            .Take(window)
            .ToListAsync(ct);

        // Get parameter metadata + spec limits
        var param = await _db.TestMethodParameters.FirstOrDefaultAsync(p => p.ParameterId == parameterId, ct);
        var specLimit = await _db.SpecLimits
            .Where(sl => sl.ParameterId == parameterId)
            .OrderByDescending(sl => sl.SpecLimitId)
            .FirstOrDefaultAsync(ct);

        double? usl = specLimit?.MaxValue.HasValue == true ? (double)specLimit.MaxValue!.Value : null;
        double? lsl = specLimit?.MinValue.HasValue == true ? (double)specLimit.MinValue!.Value : null;

        if (entries.Count < 2)
        {
            return new SpcResult(
                parameterId,
                param?.ParameterName ?? "Unknown",
                param?.Uom,
                entries.Count, 0, 0, 0, 0, usl, lsl, null, null,
                false, Array.Empty<string>(), Array.Empty<SpcDataPoint>());
        }

        var values = entries
            .OrderBy(e => e.CreatedAt)
            .Select(e => (double)e.CalculatedResult!.Value)
            .ToArray();

        double mean   = values.Average();
        double stddev = Math.Sqrt(values.Select(v => Math.Pow(v - mean, 2)).Sum() / (values.Length - 1));

        double ucl = mean + 3 * stddev;
        double lcl = mean - 3 * stddev;

        double? cp  = (usl.HasValue && lsl.HasValue && stddev > 0)
            ? (usl.Value - lsl.Value) / (6 * stddev) : null;
        double? cpk = (usl.HasValue && lsl.HasValue && stddev > 0)
            ? Math.Min((usl.Value - mean) / (3 * stddev), (mean - lsl.Value) / (3 * stddev)) : null;

        // Nelson rule violations
        var rules = new List<string>();

        // Rule 1: Any point > 3σ from mean
        bool anyOoc = values.Any(v => v > ucl || v < lcl);
        if (anyOoc) rules.Add("Rule 1: Point(s) beyond ±3σ control limits");

        // Rule 2: 9 consecutive points on same side of mean
        if (values.Length >= 9)
        {
            for (int i = 0; i <= values.Length - 9; i++)
            {
                var seg = values.Skip(i).Take(9).ToArray();
                if (seg.All(v => v > mean) || seg.All(v => v < mean))
                {
                    rules.Add("Rule 2: 9+ consecutive points on one side of mean (shift)");
                    break;
                }
            }
        }

        // Rule 3: 6 consecutive points trending monotonically
        if (values.Length >= 6)
        {
            for (int i = 0; i <= values.Length - 6; i++)
            {
                var seg = values.Skip(i).Take(6).ToArray();
                bool increasing = true, decreasing = true;
                for (int j = 1; j < seg.Length; j++)
                {
                    if (seg[j] <= seg[j - 1]) increasing = false;
                    if (seg[j] >= seg[j - 1]) decreasing = false;
                }
                if (increasing || decreasing)
                {
                    rules.Add("Rule 3: 6+ consecutive points in a monotonic trend");
                    break;
                }
            }
        }

        double sigma1 = stddev, sigma2 = 2 * stddev;

        // Rule 4: 14 consecutive points alternating up/down
        if (values.Length >= 14)
        {
            for (int i = 0; i <= values.Length - 14; i++)
            {
                var seg = values.Skip(i).Take(14).ToArray();
                bool alternating = true;
                for (int j = 1; j < seg.Length; j++)
                {
                    bool shouldBeUp = (j % 2 == 1);
                    if (shouldBeUp && seg[j] <= seg[j - 1]) { alternating = false; break; }
                    if (!shouldBeUp && seg[j] >= seg[j - 1]) { alternating = false; break; }
                }
                if (alternating) { rules.Add("Rule 4: 14+ consecutive points alternating up/down"); break; }
            }
        }

        // Rule 5: 2 of 3 consecutive points beyond ±2σ on same side
        if (values.Length >= 3)
        {
            for (int i = 0; i <= values.Length - 3; i++)
            {
                var seg = values.Skip(i).Take(3).ToArray();
                int above2 = seg.Count(v => v > mean + sigma2);
                int below2 = seg.Count(v => v < mean - sigma2);
                if (above2 >= 2 || below2 >= 2) { rules.Add("Rule 5: 2 of 3 consecutive points beyond ±2σ"); break; }
            }
        }

        // Rule 6: 4 of 5 consecutive points beyond ±1σ on same side
        if (values.Length >= 5)
        {
            for (int i = 0; i <= values.Length - 5; i++)
            {
                var seg = values.Skip(i).Take(5).ToArray();
                int above1 = seg.Count(v => v > mean + sigma1);
                int below1 = seg.Count(v => v < mean - sigma1);
                if (above1 >= 4 || below1 >= 4) { rules.Add("Rule 6: 4 of 5 consecutive points beyond ±1σ on same side"); break; }
            }
        }

        // Rule 7: 15 consecutive points within ±1σ (process too controlled / stratification)
        if (values.Length >= 15)
        {
            for (int i = 0; i <= values.Length - 15; i++)
            {
                var seg = values.Skip(i).Take(15).ToArray();
                if (seg.All(v => Math.Abs(v - mean) < sigma1))
                {
                    rules.Add("Rule 7: 15+ consecutive points within ±1σ (possible stratification)");
                    break;
                }
            }
        }

        // Rule 8: 8 consecutive points on both sides of mean but none within ±1σ
        if (values.Length >= 8)
        {
            for (int i = 0; i <= values.Length - 8; i++)
            {
                var seg = values.Skip(i).Take(8).ToArray();
                if (seg.All(v => Math.Abs(v - mean) > sigma1))
                {
                    rules.Add("Rule 8: 8+ consecutive points outside ±1σ on both sides (mixture)");
                    break;
                }
            }
        }

        // Build point series
        var orderedEntries = entries.OrderBy(e => e.CreatedAt).ToList();
        var dataPoints = orderedEntries.Select(e => new SpcDataPoint(
            e.ExecutionId,
            e.Execution.Sample.SampleNumber,
            e.CreatedAt,
            (double)e.CalculatedResult!.Value,
            e.IsOos,
            e.IsOot
        )).ToArray();

        return new SpcResult(
            ParameterId:    parameterId,
            ParameterName:  param?.ParameterName ?? "Unknown",
            Unit:           param?.Uom,
            N:              values.Length,
            Mean:           Math.Round(mean, 4),
            Stddev:         Math.Round(stddev, 4),
            Ucl:            Math.Round(ucl, 4),
            Lcl:            Math.Round(lcl, 4),
            Usl:            usl,
            Lsl:            lsl,
            Cp:             cp.HasValue ? Math.Round(cp.Value, 3) : null,
            Cpk:            cpk.HasValue ? Math.Round(cpk.Value, 3) : null,
            OutOfControl:   anyOoc || rules.Count > 0,
            Rules:          rules.ToArray(),
            Points:         dataPoints);
    }
}
