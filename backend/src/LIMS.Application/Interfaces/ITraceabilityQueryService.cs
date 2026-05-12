namespace LIMS.Application.Interfaces;

// Contract 1: Single service — all traceability graph resolution here; no denormalised copies
// Contract 2: All compute server-side; results from FK joins on digital_logbook_entries

public record TraceabilityNode(string NodeType, int NodeId, string Label, string? Detail);

public record TraceabilityGraph(
    TraceabilityNode CentralSample,
    IReadOnlyList<TraceabilityNode> UpstreamNodes,     // lot, sampling event, reagent, instrument, analyst, method
    IReadOnlyList<TraceabilityNode> DownstreamNodes,   // CoA lines, batch records, complaints/deviations
    IReadOnlyList<TraceabilityNode> LogbookNodes       // digital logbook rows as explicit nodes (FR-03)
);

public record TraceabilityFilter(
    string? Batch,
    string? Lot,
    DateTimeOffset? DateFrom,
    DateTimeOffset? DateTo,
    int? AnalystId,
    int? InstrumentId
);

public interface ITraceabilityQueryService
{
    /// <summary>
    /// Builds full traceability graph for a sample (FR-01 to FR-03, FR-08, FR-09).
    /// Logs query INSERT-only in trace_query_logs (FR-07).
    /// </summary>
    Task<TraceabilityGraph> GetGraphAsync(int sampleId, int queriedById, CancellationToken ct = default);

    /// <summary>
    /// Recall scope: from a lot node, find all affected downstream batches (FR-12).
    /// Returns sample IDs in scope — result in seconds for regulatory inspection.
    /// </summary>
    Task<IReadOnlyList<int>> GetRecallScopeAsync(string lotNumber, int queriedById, TraceabilityFilter filter, CancellationToken ct = default);

    /// <summary>
    /// Filter-driven query (FR-11): applies predicates server-side.
    /// Logs query INSERT-only in trace_query_logs (FR-07).
    /// </summary>
    Task<IReadOnlyList<TraceabilityGraph>> QueryAsync(TraceabilityFilter filter, int queriedById, CancellationToken ct = default);
}
