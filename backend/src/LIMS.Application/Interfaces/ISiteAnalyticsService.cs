namespace LIMS.Application.Interfaces;

/// <summary>
/// MS-4: Cross-site analytics — aggregates KPIs per laboratory for the
/// multi-site dashboard. Only accessible to IsCrossLab users (SuperAdmin/CorporateQA).
/// </summary>
public interface ISiteAnalyticsService
{
    /// <summary>Returns one KPI row per active laboratory.</summary>
    Task<List<SiteKpi>> GetSiteKpisAsync(int? periodDays = 30, CancellationToken ct = default);

    /// <summary>Returns TAT breakdown (min/avg/max days) per lab for a rolling window.</summary>
    Task<List<SiteTatBreakdown>> GetTatBreakdownAsync(int? periodDays = 30, CancellationToken ct = default);

    /// <summary>Returns OOS trend (weekly count) per lab for the last N weeks.</summary>
    Task<List<SiteOosTrend>> GetOosTrendAsync(int weeks = 8, CancellationToken ct = default);

    /// <summary>Returns active transfer requests visible to the given user context.</summary>
    Task<List<TransferSummary>> GetPendingTransfersAsync(int? labId = null, CancellationToken ct = default);
}

public record SiteKpi(
    int    LabId,
    string LabName,
    string Site,
    string Location,
    string LabType,
    // Sample pipeline counts
    int    TotalSamples,
    int    Registered,
    int    PendingTesting,
    int    InTesting,
    int    PendingQAReview,
    int    Released,
    int    Rejected,
    // Quality flags
    int    OosCount,
    int    OpenCapa,
    int    OverdueSamples,
    int    PendingTransfers,
    // Rates
    double OosRatePct,
    double AvgTatDays,
    double ReleaseRatePct
);

public record SiteTatBreakdown(
    int    LabId,
    string LabName,
    double MinDays,
    double AvgDays,
    double MaxDays,
    int    SampleCount
);

public record SiteOosTrend(
    int    LabId,
    string LabName,
    List<OosWeekPoint> WeeklyPoints
);

public record OosWeekPoint(string WeekLabel, int OosCount);

public record TransferSummary(
    int    SampleTransferId,
    string SampleNumber,
    string MaterialName,
    string LotNumber,
    int    FromLabId,
    string FromLabName,
    int    ToLabId,
    string ToLabName,
    string Status,
    string TransferReason,
    string RequestedBy,
    DateTimeOffset RequestedAt,
    string? ResponseNote
);
