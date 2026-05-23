namespace LIMS.Application.Interfaces;

public interface IStabilityTrendService
{
    Task<StabilityTrendResult> GetTrendDataAsync(int protocolId, int? parameterId, CancellationToken ct = default);
    Task<IchComplianceResult> GetIchComplianceAsync(int protocolId, CancellationToken ct = default);
}

public record StabilityTrendResult(
    int ProtocolId,
    string ProtocolName,
    string StorageCondition,
    int StudyDurationMonths,
    int? IntendedShelfLifeMonths,
    List<TrendParameter> Parameters
);

public record TrendParameter(
    int ParameterId,
    string ParameterName,
    string? Unit,
    double? SpecMin,
    double? SpecMax,
    double? PredictedShelfLifeMonths,
    double? RSquared,
    List<TrendDataPoint> DataPoints
);

public record TrendDataPoint(
    int MonthOffset,
    string TimePointLabel,
    double Value,
    bool IsOos,
    string SampleNumber,
    DateTimeOffset PulledAt
);

public record IchComplianceResult(
    int ProtocolId,
    string StorageCondition,
    List<IchIntervalStatus> Intervals
);

public record IchIntervalStatus(
    int MonthOffset,
    string Label,
    bool IsMandatory,
    bool IsPulled,
    int? PullId,
    string Status,
    DateTimeOffset? PulledAt
);
