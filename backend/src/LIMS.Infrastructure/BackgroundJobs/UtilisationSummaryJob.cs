using LIMS.Domain.Entities;
using LIMS.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace LIMS.Infrastructure.BackgroundJobs;

// FR-15: UtilisationSummaryJob â€” compute instrument utilisation (7/30/90 days)
// Window from DB config (Contract 2 â€” not hardcoded)
public class UtilisationSummaryJob : BackgroundService
{
    private readonly IServiceProvider _services;
    private readonly ILogger<UtilisationSummaryJob> _logger;

    public UtilisationSummaryJob(IServiceProvider services, ILogger<UtilisationSummaryJob> logger)
    { _services = services; _logger = logger; }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try { await RunAsync(stoppingToken); }
            catch (Exception ex) when (ex is not OperationCanceledException)
            { _logger.LogError(ex, "[UtilisationSummaryJob] Unhandled error — job continues next interval"); }
            var intervalHours = await GetIntervalHoursAsync(stoppingToken);
            await Task.Delay(TimeSpan.FromHours(intervalHours), stoppingToken);
        }
    }

    private async Task RunAsync(CancellationToken ct)
    {
        using var scope = _services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<LimsDbContext>();

        // Window days from DB config (Contract 2)
        var windowDays = await GetWindowDaysAsync(db, ct);

        var instruments = await db.Instruments.Where(i => i.IsActive).ToListAsync(ct);
        var now = DateTimeOffset.UtcNow;

        foreach (var instrument in instruments)
        {
            foreach (var days in windowDays)
            {
                var windowStart = now.AddDays(-days);
                var executions = await db.TestExecutions
                    .Where(e => e.InstrumentId == instrument.InstrumentId
                             && e.StartedAt >= windowStart
                             && e.CompletedAt != null)
                    .ToListAsync(ct);

                var totalTests = executions.Count;
                var totalHours = executions.Sum(e => (decimal)(e.CompletedAt!.Value - e.StartedAt!.Value).TotalHours);
                var utilisationPct = days > 0 ? Math.Round(totalHours / (days * 24) * 100, 2) : 0;

                // Upsert: remove existing summary for same instrument+window before recalculating (prevents duplicates)
                var existing = await db.InstrumentUtilisationSummaries
                    .Where(s => s.InstrumentId == instrument.InstrumentId
                             && s.WindowDays == days
                             && s.WindowStart.Date == windowStart.Date)
                    .ToListAsync(ct);
                if (existing.Any()) db.InstrumentUtilisationSummaries.RemoveRange(existing);

                db.InstrumentUtilisationSummaries.Add(new InstrumentUtilisationSummary
                {
                    InstrumentId = instrument.InstrumentId,
                    WindowDays = days,
                    WindowStart = windowStart,
                    WindowEnd = now,
                    TotalTests = totalTests,
                    TotalHours = totalHours,
                    UtilisationPct = utilisationPct,
                    CalculatedAt = now
                });
            }
        }

        if (instruments.Count > 0)
        {
            await db.SaveChangesAsync(ct);
            _logger.LogInformation("UtilisationSummaryJob: computed summaries for {Count} instruments", instruments.Count);
        }
    }

    private async Task<int[]> GetWindowDaysAsync(LimsDbContext db, CancellationToken ct)
    {
        var config = await db.LabConfigs.FirstOrDefaultAsync(c => c.ConfigKey == "utilisation_window_days", ct);
        if (config != null && !string.IsNullOrEmpty(config.ConfigValue))
        {
            var parsed = config.ConfigValue.Split(',')
                .Select(s => int.TryParse(s.Trim(), out var d) ? (int?)d : null)
                .Where(d => d.HasValue).Select(d => d!.Value).ToArray();
            if (parsed.Length > 0) return parsed;
        }
        return new[] { 7, 30, 90 };   // fallback â€” admin should set utilisation_window_days in LabConfig
    }

    private async Task<double> GetIntervalHoursAsync(CancellationToken ct)
    {
        try
        {
            using var scope = _services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<LimsDbContext>();
            var config = await db.LabConfigs.FirstOrDefaultAsync(c => c.ConfigKey == "utilisation_calc_interval_hrs", ct);
            if (config != null && double.TryParse(config.ConfigValue, out var h)) return h;
        }
        catch { }
        return 24;
    }
}

