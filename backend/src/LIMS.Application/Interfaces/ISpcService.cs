namespace LIMS.Application.Interfaces;

public interface ISpcService
{
    Task<SpcResult> CalculateAsync(int parameterId, int? labId, int? points, CancellationToken ct = default);
}

public record SpcResult(
    int ParameterId,
    string ParameterName,
    string? Unit,
    int N,
    double Mean,
    double Stddev,
    double Ucl,      // Upper Control Limit = Mean + 3σ
    double Lcl,      // Lower Control Limit = Mean − 3σ
    double? Usl,     // Upper Spec Limit (from spec limit DB)
    double? Lsl,     // Lower Spec Limit
    double? Cp,      // Capability index (USL-LSL)/(6σ)
    double? Cpk,     // Min((USL−Mean)/(3σ), (Mean−LSL)/(3σ))
    bool OutOfControl,
    string[] Rules,  // Violated SPC rules (Nelson/Western Electric)
    SpcDataPoint[] Points);

public record SpcDataPoint(
    int ExecutionId,
    string SampleNumber,
    DateTimeOffset MeasuredAt,
    double Value,
    bool IsOos,
    bool IsOot);

// ── Levey-Jennings QC Chart ──────────────────────────────────────────────────
public interface IQcChartService
{
    Task<QcChartResult> GetChartAsync(int parameterId, int? labId, int? points, CancellationToken ct = default);
}

public record QcChartResult(
    int ParameterId,
    string ParameterName,
    string? Unit,
    QcLotSeries[] Lots);

public record QcLotSeries(
    string LotNumber,
    int N,
    double Mean,
    double Sigma,       // 1σ
    double Usl2,        // +2σ
    double Lsl2,        // -2σ
    double Usl3,        // +3σ (control limit)
    double Lsl3,        // -3σ
    string[] Violations,
    QcPoint[] Points);

public record QcPoint(
    string SampleNumber,
    DateTimeOffset MeasuredAt,
    double Value,
    int SigmaZone);     // 0=within1σ, 1=1-2σ, 2=2-3σ, 3=beyond3σ
