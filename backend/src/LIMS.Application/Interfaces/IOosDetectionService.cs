namespace LIMS.Application.Interfaces;

public record OosDetectionResult(bool IsOos, bool IsOot, string PassFail);

public interface IOosDetectionService
{
    OosDetectionResult Detect(
        decimal? calculatedResult,
        decimal? specMin, decimal? specMax,
        decimal? ootMin, decimal? ootMax);
}
