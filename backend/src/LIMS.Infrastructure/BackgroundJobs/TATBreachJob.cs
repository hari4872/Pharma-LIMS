using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Domain.Enums;
using LIMS.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace LIMS.Infrastructure.BackgroundJobs;

// FR-07: TATBreachJob — detect TAT target breaches server-side (Contract 2)
// TAT target from DB config — no hardcoding (Contract 2)
// Runs hourly (Contract 2 — interval from DB config)
public class TATBreachJob : BackgroundService
{
    private readonly IServiceProvider _services;
    private readonly ILogger<TATBreachJob> _logger;

    public TATBreachJob(IServiceProvider services, ILogger<TATBreachJob> logger)
    { _services = services; _logger = logger; }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try { await RunAsync(stoppingToken); }
            catch (Exception ex) when (ex is not OperationCanceledException)
            { _logger.LogError(ex, "[TATBreachJob] Unhandled error — job continues next interval"); }
            var intervalHours = await GetIntervalHoursAsync(stoppingToken);
            await Task.Delay(TimeSpan.FromHours(intervalHours), stoppingToken);
        }
    }

    private async Task RunAsync(CancellationToken ct)
    {
        using var scope = _services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<LimsDbContext>();
        var notifications = scope.ServiceProvider.GetRequiredService<INotificationService>();

        // TAT target from DB config (Contract 2 — not hardcoded)
        var targetConfig = await db.LabConfigs.FirstOrDefaultAsync(c => c.ConfigKey == "tat_target_hrs", ct);
        var targetHours  = targetConfig != null && decimal.TryParse(targetConfig.ConfigValue, out var t) ? t : 48m;

        var now = DateTimeOffset.UtcNow;

        // Find samples exceeding TAT target that haven't been logged yet
        var overdueExecIds = await db.TatBreachLogs.Select(b => b.SampleId).ToListAsync(ct);

        var breachingSamples = await db.Samples
            .Include(s => s.Material)
            .Where(s => s.DueDate < now
                     && s.Status != SampleStatus.Released
                     && s.Status != SampleStatus.Rejected
                     && !overdueExecIds.Contains(s.SampleId))
            .ToListAsync(ct);

        foreach (var sample in breachingSamples)
        {
            var actualHours = (decimal)(now - sample.CreatedAt).TotalHours;
            var breach = new TatBreachLog
            {
                SampleId = sample.SampleId,
                TargetHours = targetHours,
                ActualHours = actualHours,
                BreachHours = actualHours - targetHours,
                DetectedAt = now
            };
            db.TatBreachLogs.Add(breach);
        }

        if (breachingSamples.Count > 0)
        {
            await db.SaveChangesAsync(ct);
            _logger.LogWarning("TATBreachJob: {Count} new TAT breaches detected", breachingSamples.Count);

            await notifications.PushToGroupAsync("QCLead", "TATBreach", new
            {
                Count = breachingSamples.Count,
                TargetHours = targetHours,
                Samples = breachingSamples.Select(s => new { s.SampleId, s.SampleNumber, s.DueDate, MaterialName = s.Material?.MaterialName ?? "Unknown" })
            }, ct);
        }
    }

    private async Task<double> GetIntervalHoursAsync(CancellationToken ct)
    {
        try
        {
            using var scope = _services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<LimsDbContext>();
            var config = await db.LabConfigs.FirstOrDefaultAsync(c => c.ConfigKey == "tat_breach_check_interval_hrs", ct);
            if (config != null && double.TryParse(config.ConfigValue, out var h)) return h;
        }
        catch { }
        return 1;  // hourly by default (Contract 2 — configurable via DB)
    }
}

