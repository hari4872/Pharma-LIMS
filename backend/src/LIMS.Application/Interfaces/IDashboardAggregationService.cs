namespace LIMS.Application.Interfaces;

// Contract 1: Single aggregation source for ALL dashboard metrics (FR-10)
// Contract 2: All compute server-side — React renders results, never computes
// All thresholds from DB config (Contract 2 — no hardcoded values, FR-11)

public record WipSummary(
    int RegisteredToday, int InTesting, int CompletedToday,
    int TestsPending, int TestsInProgress, int TestsCompleted,
    int OverdueSamples,
    IReadOnlyList<AnalystWorkload> AnalystWorkloads
);
public record AnalystWorkload(int AnalystId, string AnalystName, int OpenTasks);

public record TatSummary(
    decimal AvgTatHours, decimal TargetTatHours,
    int BreachCount, int PeriodDays,
    IReadOnlyList<TatByAnalyst> ByAnalyst
);
public record TatByAnalyst(int AnalystId, string AnalystName, decimal AvgTatHours);

public record QualityKpis(
    decimal OosRate, decimal OotRate, decimal RftRate, decimal RetestRate,
    int OpenCapaCount, int PeriodDays
);

public record InstrumentStatusBoardItem(
    int InstrumentId, string InstrumentCode, string InstrumentType,
    string Status, DateOnly CalibrationDue, int DaysUntilCalDue,
    int? OpenBreakdownId, decimal? UtilisationPct
);

public record ComplianceSummary(
    int TotalAuditEvents, int OpenOosCount, int ClosedOosCount,
    int TotalSignatures, DateTimeOffset? LastBackupAt, string SystemHealthStatus
);

public interface IDashboardAggregationService
{
    Task<WipSummary> GetWipSummaryAsync(int? labId, CancellationToken ct = default);
    Task<TatSummary> GetTatSummaryAsync(int? labId, int? periodDays, CancellationToken ct = default);
    Task<QualityKpis> GetQualityKpisAsync(int? labId, int? periodDays, CancellationToken ct = default);
    Task<IReadOnlyList<InstrumentStatusBoardItem>> GetInstrumentStatusBoardAsync(int? labId, CancellationToken ct = default);
    Task<ComplianceSummary> GetComplianceSummaryAsync(CancellationToken ct = default);
}
