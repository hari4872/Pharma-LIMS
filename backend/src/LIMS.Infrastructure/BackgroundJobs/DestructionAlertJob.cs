using LIMS.Application.Interfaces;
using LIMS.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace LIMS.Infrastructure.BackgroundJobs;

// FR-14: DestructionAlertJob â€” T-90 and T-30 retain sample destruction due date alerts
// Alert days from DB config (Contract 2 â€” no hardcoding)
// IHostedService â€” runs server-side, daily
public class DestructionAlertJob : BackgroundService
{
    private readonly IServiceProvider _services;
    private readonly ILogger<DestructionAlertJob> _logger;

    public DestructionAlertJob(IServiceProvider services, ILogger<DestructionAlertJob> logger)
    { _services = services; _logger = logger; }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try { await RunAsync(stoppingToken); }
            catch (Exception ex) when (ex is not OperationCanceledException)
            { _logger.LogError(ex, "[DestructionAlertJob] Unhandled error — job continues next interval"); }
            var intervalHours = await GetIntervalHoursAsync(stoppingToken);
            await Task.Delay(TimeSpan.FromHours(intervalHours), stoppingToken);
        }
    }

    private async Task RunAsync(CancellationToken ct)
    {
        using var scope = _services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<LimsDbContext>();
        var notifications = scope.ServiceProvider.GetRequiredService<INotificationService>();

        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        // Alert threshold days from DB config (Contract 2)
        var alertDays = await GetAlertDaysAsync(db, ct);

        foreach (var days in alertDays)
        {
            var alertDate = today.AddDays(days);
            var dueRetains = await db.RetainSamples
                .Include(r => r.Sample).ThenInclude(s => s.Material)
                .Include(r => r.Location)
                .Where(r => r.Status == "Active" && r.RetentionDueDate == alertDate)
                .ToListAsync(ct);

            if (dueRetains.Count > 0)
            {
                _logger.LogInformation("DestructionAlertJob: {Count} retain samples due for destruction in T-{Days}", dueRetains.Count, days);
                await notifications.PushToGroupAsync("QA", "RetainDestructionDue", new
                {
                    DaysRemaining = days,
                    Retains = dueRetains.Select(r => new
                    {
                        r.RetainId, r.SampleId,
                        SampleNumber = r.Sample.SampleNumber,
                        MaterialName = r.Sample.Material.MaterialName,
                        r.LotNumber, r.RetentionDueDate,
                        LocationCode = r.Location.LocationCode
                    })
                }, ct);
            }
        }
    }

    private async Task<int[]> GetAlertDaysAsync(LimsDbContext db, CancellationToken ct)
    {
        // Alert days from DB config â€” not hardcoded (Contract 2)
        var config = await db.LabConfigs.FirstOrDefaultAsync(c => c.ConfigKey == "destruction_alert_days", ct);
        if (config != null && !string.IsNullOrEmpty(config.ConfigValue))
        {
            var parsed = config.ConfigValue.Split(',')
                .Select(s => int.TryParse(s.Trim(), out var d) ? (int?)d : null)
                .Where(d => d.HasValue)
                .Select(d => d!.Value)
                .ToArray();
            if (parsed.Length > 0) return parsed;
        }
        return new[] { 90, 30 }; // fallback T-90 and T-30 â€” admin should set destruction_alert_days in LabConfig
    }

    private async Task<double> GetIntervalHoursAsync(CancellationToken ct)
    {
        try
        {
            using var scope = _services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<LimsDbContext>();
            var config = await db.LabConfigs.FirstOrDefaultAsync(c => c.ConfigKey == "destruction_check_interval_hrs", ct);
            if (config != null && double.TryParse(config.ConfigValue, out var h)) return h;
        }
        catch { }
        return 24;
    }
}

