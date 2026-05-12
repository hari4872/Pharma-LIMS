using LIMS.Application.Interfaces;

namespace LIMS.Infrastructure.Services;

// Contract 1: single service for both OOS and OOT — no duplicate logic (FR-04, FR-18)
public class OosDetectionService : IOosDetectionService
{
    public OosDetectionResult Detect(
        decimal? calculatedResult,
        decimal? specMin, decimal? specMax,
        decimal? ootMin, decimal? ootMax)
    {
        if (!calculatedResult.HasValue)
            return new OosDetectionResult(false, false, "PASS");

        var val = calculatedResult.Value;

        // OOS: outside in-house spec limits (FDA OOS Guidance 2006)
        bool isOos = false;
        if (specMin.HasValue && val < specMin.Value) isOos = true;
        if (specMax.HasValue && val > specMax.Value) isOos = true;

        // OOT: outside trend limits — separate flag, same service (FR-18 GMP trending)
        bool isOot = false;
        if (!isOos) // only raise OOT if not already OOS
        {
            if (ootMin.HasValue && val < ootMin.Value) isOot = true;
            if (ootMax.HasValue && val > ootMax.Value) isOot = true;
        }

        string passFail = isOos ? "FAIL" : "PASS";
        return new OosDetectionResult(isOos, isOot, passFail);
    }
}
