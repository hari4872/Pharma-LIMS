using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace LIMS.Infrastructure.Services;

// Contract 1: Single service — all traceability graph resolution; no denormalised copies
// Contract 2: All compute server-side; all FK joins from digital_logbook_entries
// 21 CFR §11.10(e): every query INSERT-only in trace_query_logs
public class TraceabilityQueryService : ITraceabilityQueryService
{
    private readonly ILimsDbContext _db;
    public TraceabilityQueryService(ILimsDbContext db) { _db = db; }

    public async Task<TraceabilityGraph> GetGraphAsync(int sampleId, int queriedById, CancellationToken ct = default)
    {
        var sample = await _db.Samples
            .Include(s => s.Material)
            .Include(s => s.SampleTypeNav)
            .Include(s => s.Analyst)
            .FirstOrDefaultAsync(s => s.SampleId == sampleId, ct)
            ?? throw new InvalidOperationException($"Sample {sampleId} not found.");

        var upstream = new List<TraceabilityNode>();
        var downstream = new List<TraceabilityNode>();
        var logbookNodes = new List<TraceabilityNode>();

        // Upstream: Material Lot node
        upstream.Add(new TraceabilityNode("MaterialLot", sample.MaterialId,
            $"Lot: {sample.LotNumber}",
            $"{sample.Material.MaterialName} | Exp: {sample.ExpDate}"));

        // Upstream: Sampling Events (FR-09) — who sampled, when, where
        var samplingEvents = await _db.SamplingEvents
            .Include(e => e.SampledBy)
            .Where(e => e.SampleId == sampleId)
            .ToListAsync(ct);
        foreach (var ev in samplingEvents)
        {
            upstream.Add(new TraceabilityNode("SamplingEvent", ev.SamplingEventId,
                $"Sampled by: {ev.SampledBy.FullName}",
                $"At: {ev.SampledAt:u} | Location: {ev.Location} | Qty: {ev.QuantityTaken} {ev.QuantityUom}"));
        }

        // Central: Digital Logbook rows — FR-03 explicit nodes
        var logbookEntries = await _db.DigitalLogbookEntries
            .Include(e => e.Parameter)
            .Include(e => e.Analyst)
            .Include(e => e.Instrument)
            .Include(e => e.Execution).ThenInclude(ex => ex.FormTemplate)
            .Include(e => e.Execution).ThenInclude(ex => ex.SpecTemplateItem!).ThenInclude(i => i.TestMethod)
            .Include(e => e.Execution).ThenInclude(ex => ex.SpecTemplateItem!).ThenInclude(i => i.Parameter)
            .Where(e => e.SampleId == sampleId && e.Status != LogbookEntryStatus.Superseded)
            .ToListAsync(ct);

        foreach (var entry in logbookEntries)
        {
            logbookNodes.Add(new TraceabilityNode("LogbookEntry", entry.EntryId,
                $"{entry.Parameter.ParameterName}: {entry.RawValue} ({entry.PassFail})",
                $"Analyst: {entry.Analyst.FullName} | Instrument: {entry.Instrument?.SerialNumber} | OOS: {entry.IsOos} | OOT: {entry.IsOot}"));

            // Upstream: Instrument context nodes
            if (entry.InstrumentId.HasValue && entry.Instrument != null)
            {
                if (!upstream.Any(n => n.NodeType == "Instrument" && n.NodeId == entry.InstrumentId.Value))
                    upstream.Add(new TraceabilityNode("Instrument", entry.InstrumentId.Value,
                        $"Instrument: {entry.Instrument.SerialNumber}",
                        $"Cal Status: {entry.Instrument.Status}"));
            }

            // Upstream: Analyst context nodes
            if (!upstream.Any(n => n.NodeType == "Analyst" && n.NodeId == entry.AnalystId))
                upstream.Add(new TraceabilityNode("Analyst", entry.AnalystId,
                    $"Analyst: {entry.Analyst.FullName}",
                    $"Role: {entry.Analyst.Role}"));

            // Upstream: TestExecution node — label shows method group name when available
            if (entry.Execution != null)
            {
                var execLabel = entry.Execution.SpecTemplateItem?.TestMethod?.MethodName
                    ?? entry.Execution.SpecTemplateItem?.Parameter?.ParameterName
                    ?? $"Execution #{entry.ExecutionId}";
                if (!upstream.Any(n => n.NodeType == "TestExecution" && n.NodeId == entry.ExecutionId))
                    upstream.Add(new TraceabilityNode("TestExecution", entry.ExecutionId,
                        execLabel,
                        $"Status: {entry.Execution.Status} | #{entry.ExecutionId}"));
            }
        }

        // Downstream: CoA Lines → CoAs
        var coaLines = await _db.CoaLines
            .Include(l => l.Coa)
            .Where(l => l.Coa.SampleId == sampleId)
            .ToListAsync(ct);
        foreach (var line in coaLines)
        {
            if (!downstream.Any(n => n.NodeType == "CoA" && n.NodeId == line.CoaId))
                downstream.Add(new TraceabilityNode("CoA", line.CoaId,
                    $"CoA: {line.Coa.CoaNumber}",
                    $"Status: {line.Coa.Status}"));
        }

        // Downstream: Complaints/Deviations (FR-08)
        var cds = await _db.ComplaintsDeviations
            .Where(c => c.SampleId == sampleId)
            .ToListAsync(ct);
        foreach (var cd in cds)
        {
            downstream.Add(new TraceabilityNode("ComplaintsDeviation", cd.CdId,
                $"{cd.CdType}: {cd.CdReference}",
                $"Status: {cd.Status} | Opened: {cd.OpenedAt:yyyy-MM-dd}"));
        }

        var centralNode = new TraceabilityNode("Sample", sample.SampleId,
            sample.SampleNumber, $"{sample.Material.MaterialName} | {sample.SampleTypeNav.TypeName} | Status: {sample.Status}");

        // FR-07: INSERT-only query log (21 CFR §11.10(e))
        await LogQueryAsync(queriedById, new { sampleId }, upstream.Count + logbookNodes.Count + downstream.Count, ct);

        return new TraceabilityGraph(centralNode, upstream, downstream, logbookNodes);
    }

    public async Task<IReadOnlyList<int>> GetRecallScopeAsync(
        string lotNumber, int queriedById, TraceabilityFilter filter, CancellationToken ct = default)
    {
        // Recall scope: from lot node, find all affected downstream sample IDs
        var query = _db.Samples
            .Where(s => s.LotNumber == lotNumber);

        if (filter.DateFrom.HasValue)
            query = query.Where(s => s.CreatedAt >= filter.DateFrom.Value);
        if (filter.DateTo.HasValue)
            query = query.Where(s => s.CreatedAt <= filter.DateTo.Value);

        var sampleIds = await query.Select(s => s.SampleId).ToListAsync(ct);

        await LogQueryAsync(queriedById,
            new { recall = true, lotNumber, dateFrom = filter.DateFrom, dateTo = filter.DateTo },
            sampleIds.Count, ct);

        return sampleIds;
    }

    public async Task<IReadOnlyList<TraceabilityGraph>> QueryAsync(
        TraceabilityFilter filter, int queriedById, CancellationToken ct = default)
    {
        var sampleQuery = _db.Samples.AsQueryable();
        if (!string.IsNullOrEmpty(filter.Lot)) sampleQuery = sampleQuery.Where(s => s.LotNumber == filter.Lot);
        if (!string.IsNullOrEmpty(filter.Batch)) sampleQuery = sampleQuery.Where(s => s.Material.MaterialName.Contains(filter.Batch));
        if (filter.DateFrom.HasValue) sampleQuery = sampleQuery.Where(s => s.CreatedAt >= filter.DateFrom.Value);
        if (filter.DateTo.HasValue) sampleQuery = sampleQuery.Where(s => s.CreatedAt <= filter.DateTo.Value);
        if (filter.AnalystId.HasValue) sampleQuery = sampleQuery.Where(s => s.AnalystId == filter.AnalystId.Value);

        var sampleIds = await sampleQuery.Select(s => s.SampleId).Take(100).ToListAsync(ct);
        var graphs = new List<TraceabilityGraph>();
        foreach (var id in sampleIds)
            graphs.Add(await GetGraphAsync(id, queriedById, ct));

        return graphs;
    }

    private async Task LogQueryAsync(int queriedById, object filterParams, int resultCount, CancellationToken ct)
    {
        _db.TraceQueryLogs.Add(new TraceQueryLog
        {
            QueriedById = queriedById,
            QueriedAt = DateTimeOffset.UtcNow,
            FilterParams = System.Text.Json.JsonSerializer.Serialize(filterParams),
            ResultCount = resultCount
        });
        await _db.SaveChangesAsync(ct);
    }
}
