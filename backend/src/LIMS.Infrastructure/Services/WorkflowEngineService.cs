using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Infrastructure.Services;

public class WorkflowEngineService : IWorkflowEngineService
{
    private readonly ILimsDbContext _db;
    public WorkflowEngineService(ILimsDbContext db) => _db = db;

    public async Task<WorkflowTemplate?> GetActiveTemplateAsync(int materialId, int sampleTypeId, CancellationToken ct = default)
    {
        var templates = await _db.WorkflowTemplates
            .Include(t => t.Steps.OrderBy(s => s.StepOrder))
            .Where(t => t.IsActive)
            .ToListAsync(ct);

        // Exact match first (both material and sample type)
        var exact = templates.FirstOrDefault(t =>
            t.MaterialId == materialId && t.SampleTypeId == sampleTypeId);
        if (exact is not null) return exact;

        // Material-only match
        var matOnly = templates.FirstOrDefault(t =>
            t.MaterialId == materialId && t.SampleTypeId == null);
        if (matOnly is not null) return matOnly;

        // SampleType-only match
        var stOnly = templates.FirstOrDefault(t =>
            t.MaterialId == null && t.SampleTypeId == sampleTypeId);
        if (stOnly is not null) return stOnly;

        // Default fallback
        return templates.FirstOrDefault(t => t.IsDefault && t.MaterialId == null && t.SampleTypeId == null);
    }

    public async Task<List<WorkflowStep>> GetStepsAsync(int sampleId, CancellationToken ct = default)
    {
        var sample = await _db.Samples.FindAsync([sampleId], ct);
        if (sample is null) return [];
        var template = await GetActiveTemplateAsync(sample.MaterialId, sample.SampleTypeId, ct);
        return template?.Steps.OrderBy(s => s.StepOrder).ToList() ?? [];
    }

    public async Task<GateCheckResult> CheckGatesAsync(int sampleId, string gateCondition, CancellationToken ct = default)
    {
        return gateCondition switch
        {
            "AllTestsComplete" => await CheckAllTestsComplete(sampleId, ct),
            "NoOpenOOS"        => await CheckNoOpenOos(sampleId, ct),
            "LogbookSigned"    => await CheckLogbookSigned(sampleId, ct),
            "CoAApproved"      => await CheckCoaApproved(sampleId, ct),
            _                  => new GateCheckResult(true, "No gate condition — auto-pass"),
        };
    }

    private async Task<GateCheckResult> CheckAllTestsComplete(int sampleId, CancellationToken ct)
    {
        var total    = await _db.TestExecutions.CountAsync(e => e.SampleId == sampleId, ct);
        var complete = await _db.TestExecutions.CountAsync(e => e.SampleId == sampleId &&
            (e.Status == TestExecutionStatus.Completed || e.Status == TestExecutionStatus.OOSOpen), ct);
        bool pass = total > 0 && complete == total;
        return new GateCheckResult(pass, pass
            ? $"All {total} test(s) complete."
            : $"{complete}/{total} tests complete — {total - complete} still in progress.");
    }

    private async Task<GateCheckResult> CheckNoOpenOos(int sampleId, CancellationToken ct)
    {
        var openOos = await _db.OosInvestigations
            .Join(_db.TestExecutions, o => o.ExecutionId, ex => ex.ExecutionId, (o, ex) => new { o, ex })
            .CountAsync(x => x.ex.SampleId == sampleId && x.o.Status != OosStatus.Closed, ct);
        return new GateCheckResult(openOos == 0,
            openOos == 0 ? "No open OOS investigations." : $"{openOos} open OOS investigation(s) must be closed first.");
    }

    private async Task<GateCheckResult> CheckLogbookSigned(int sampleId, CancellationToken ct)
    {
        var unsigned = await _db.DigitalLogbookEntries
            .Join(_db.TestExecutions, e => e.ExecutionId, ex => ex.ExecutionId, (e, ex) => new { e, ex })
            .CountAsync(x => x.ex.SampleId == sampleId && x.e.Status == LogbookEntryStatus.Pending, ct);
        return new GateCheckResult(unsigned == 0,
            unsigned == 0 ? "All logbook entries signed." : $"{unsigned} unsigned logbook entry/entries remain.");
    }

    private async Task<GateCheckResult> CheckCoaApproved(int sampleId, CancellationToken ct)
    {
        var hasCoa = await _db.Coas.AnyAsync(c => c.SampleId == sampleId && c.Status == CoaStatus.Released, ct);
        return new GateCheckResult(hasCoa,
            hasCoa ? "Certificate of Analysis approved." : "No approved CoA found for this sample.");
    }
}
