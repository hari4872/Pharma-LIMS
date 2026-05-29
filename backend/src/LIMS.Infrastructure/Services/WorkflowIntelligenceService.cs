using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Infrastructure.Services;

/// <summary>
/// Sprint 6 — Intelligent Workflow Engine
/// Risk-based priority scoring, workload balancing, and TAT prediction.
///
/// Priority algorithm:
///   Base score starts at 50.
///   Deductions (lower = more urgent):
///     -20 if IsRush
///     -15 if TAT remaining < 24h
///     -10 if TAT remaining < 48h
///     -10 if OOS open for this sample
///     -5  if material is critical (IsCritical param exists for sample's spec)
///   Score is clamped to [1, 100].
/// </summary>
public class WorkflowIntelligenceService : IWorkflowIntelligenceService
{
    private readonly ILimsDbContext _db;
    public WorkflowIntelligenceService(ILimsDbContext db) => _db = db;

    public async Task<int> CalculatePriorityScoreAsync(int executionId, CancellationToken ct = default)
    {
        var exec = await _db.TestExecutions
            .Include(e => e.Sample)
            .FirstOrDefaultAsync(e => e.ExecutionId == executionId, ct);
        if (exec is null) return 50;

        int score = 50;

        // Rush sample
        if (exec.Sample.IsRush) score -= 20;

        // TAT proximity
        if (exec.Sample.DueDate.HasValue)
        {
            var remaining = exec.Sample.DueDate.Value - DateTimeOffset.UtcNow;
            if (remaining.TotalHours < 24)  score -= 15;
            else if (remaining.TotalHours < 48) score -= 10;
        }

        // Open OOS for same execution
        var hasOpenOos = await _db.OosInvestigations
            .AnyAsync(o => o.ExecutionId == executionId && o.Status == OosStatus.Open, ct);
        if (hasOpenOos) score -= 10;

        // Critical parameter for the sample's spec template
        if (exec.Sample.SpecTemplateId.HasValue)
        {
            var hasCritical = await _db.TestMethodParameters
                .AnyAsync(p => p.IsCritical &&
                    _db.SpecificationTemplates.Any(st =>
                        st.SpecTemplateId == exec.Sample.SpecTemplateId &&
                        st.Items.Any(i => i.ParameterId == p.ParameterId)), ct);
            if (hasCritical) score -= 5;
        }

        return Math.Max(1, Math.Min(100, score));
    }

    public async Task<WorkloadSuggestion?> SuggestAnalystAsync(int labId, CancellationToken ct = default)
    {
        // Get analysts in this lab
        var analysts = await _db.Users
            .Where(u => u.IsActive && u.LabId == labId &&
                        (u.Role == UserRole.Analyst || u.Role == UserRole.QCLead))
            .ToListAsync(ct);

        if (!analysts.Any()) return null;

        // Count active (Assigned + InProgress) executions per analyst
        var loads = new List<(int UserId, string Name, int Count)>();
        foreach (var a in analysts)
        {
            var count = await _db.TestExecutions
                .CountAsync(e => e.AnalystId == a.UserId &&
                    (e.Status == TestExecutionStatus.Assigned || e.Status == TestExecutionStatus.InProgress), ct);
            loads.Add((a.UserId, a.FullName, count));
        }

        var lightest = loads.OrderBy(l => l.Count).First();
        return new WorkloadSuggestion(
            lightest.UserId,
            lightest.Name,
            lightest.Count,
            $"Least loaded analyst ({lightest.Count} active task{(lightest.Count != 1 ? "s" : "")})");
    }

    public async Task<double?> PredictTatAsync(int parameterId, int labId, CancellationToken ct = default)
    {
        var cutoff = DateTimeOffset.UtcNow.AddDays(-30);

        // Average TAT = Assigned → Completed, for same parameter in this lab in last 30 days
        var completed = await _db.TestExecutions
            .Include(e => e.Sample)
            .Where(e => e.Status == TestExecutionStatus.Completed
                     && e.Sample.LabId == labId
                     && e.CompletedAt.HasValue
                     && e.StartedAt.HasValue
                     && e.CreatedAt >= cutoff)
            .Select(e => new { e.StartedAt, e.CompletedAt })
            .ToListAsync(ct);

        if (!completed.Any()) return null;

        var avgHours = completed
            .Select(e => (e.CompletedAt!.Value - e.StartedAt!.Value).TotalHours)
            .Average();

        return Math.Round(avgHours, 1);
    }

    public async Task<QueueIntelligence> GetQueueIntelligenceAsync(int labId, CancellationToken ct = default)
    {
        var now = DateTimeOffset.UtcNow;

        var execs = await _db.TestExecutions
            .Include(e => e.Sample)
            .Include(e => e.Analyst)
            .Where(e => e.Sample.LabId == labId &&
                        (e.Status == TestExecutionStatus.Assigned || e.Status == TestExecutionStatus.InProgress || e.Status == TestExecutionStatus.OOSOpen))
            .ToListAsync(ct);

        int total   = execs.Count;
        int overdue = execs.Count(e => e.Sample.DueDate.HasValue && e.Sample.DueDate.Value < now);
        int oosOpen = execs.Count(e => e.Status == TestExecutionStatus.OOSOpen);

        // Analyst loads
        var analystLoads = execs
            .GroupBy(e => e.AnalystId)
            .Select(g => new AnalystLoad(
                g.Key,
                g.First().Analyst?.FullName ?? "Unassigned",
                g.Count(e => e.Status == TestExecutionStatus.Assigned),
                g.Count(e => e.Status == TestExecutionStatus.InProgress),
                g.Count(e => e.Sample.DueDate.HasValue && e.Sample.DueDate.Value < now)
            ))
            .OrderByDescending(a => a.Assigned + a.InProgress)
            .ToArray();

        // Priority bands by priorityScore
        var bands = new[]
        {
            new PriorityBand("Critical (1-10)",  execs.Count(e => e.PriorityScore is >= 1 and <= 10)),
            new PriorityBand("High (11-30)",     execs.Count(e => e.PriorityScore is > 10 and <= 30)),
            new PriorityBand("Medium (31-60)",   execs.Count(e => e.PriorityScore is > 30 and <= 60)),
            new PriorityBand("Low (61-100)",     execs.Count(e => e.PriorityScore is > 60 or null)),
        };

        // Average TAT over last 30 days
        var cutoff = now.AddDays(-30);
        var completed = await _db.TestExecutions
            .Include(e => e.Sample)
            .Where(e => e.Sample.LabId == labId
                     && e.Status == TestExecutionStatus.Completed
                     && e.CompletedAt.HasValue && e.StartedAt.HasValue
                     && e.CreatedAt >= cutoff)
            .Select(e => new { e.StartedAt, e.CompletedAt })
            .ToListAsync(ct);

        double? avgTat = completed.Any()
            ? Math.Round(completed.Average(e => (e.CompletedAt!.Value - e.StartedAt!.Value).TotalHours), 1)
            : null;

        return new QueueIntelligence(labId, total, overdue, oosOpen, analystLoads, bands, avgTat);
    }
}
