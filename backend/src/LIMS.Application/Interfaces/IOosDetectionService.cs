namespace LIMS.Application.Interfaces;

// TrendLow/TrendHigh = mean ± 2σ at detection time; null when history insufficient (< 6 results)
public record OosDetectionResult(bool IsOos, bool IsOot, string PassFail,
    decimal? TrendLow = null, decimal? TrendHigh = null);

public interface IOosDetectionService
{
    // history = prior Signed, non-OOS CalculatedResults for same parameter + material (up to 20)
    OosDetectionResult Detect(
        decimal? calculatedResult,
        decimal? specMin, decimal? specMax,
        IReadOnlyList<decimal> history);
}
