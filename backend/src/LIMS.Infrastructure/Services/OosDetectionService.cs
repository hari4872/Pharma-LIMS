using LIMS.Application.Interfaces;

namespace LIMS.Infrastructure.Services;

// Contract 1: single service for both OOS and OOT — no duplicate logic (FR-04, FR-18)
public class OosDetectionService : IOosDetectionService
{
    // Minimum prior results required before OOT can fire — fewer results give unreliable σ
    private const int MinHistoryForOot = 6;

    public OosDetectionResult Detect(
        decimal? calculatedResult,
        decimal? specMin, decimal? specMax,
        IReadOnlyList<decimal> history)
    {
        if (!calculatedResult.HasValue)
            return new OosDetectionResult(false, false, "PASS");

        var val = calculatedResult.Value;

        // OOS: outside in-house spec limits (FDA OOS Guidance 2006)
        bool isOos = false;
        if (specMin.HasValue && val < specMin.Value) isOos = true;
        if (specMax.HasValue && val > specMax.Value) isOos = true;

        // OOT: statistical trend detection — 2-sigma rule (ICH Q10, PIC/S PI 006-3)
        // OOS results are excluded from the historical baseline by the caller.
        // Requires >= 6 prior results; σ = 0 means all identical → no trend risk → skip.
        bool isOot = false;
        decimal? trendLow = null, trendHigh = null;
        if (!isOos && history.Count >= MinHistoryForOot)
        {
            var mean = history.Average();
            var variance = history.Average(x => (x - mean) * (x - mean));
            var stdDev = (decimal)Math.Sqrt((double)variance);
            if (stdDev > 0)
            {
                trendLow  = mean - 2 * stdDev;
                trendHigh = mean + 2 * stdDev;
                isOot = val < trendLow.Value || val > trendHigh.Value;
            }
        }

        string passFail = isOos ? "FAIL" : "PASS";
        return new OosDetectionResult(isOos, isOot, passFail, trendLow, trendHigh);
    }
}
