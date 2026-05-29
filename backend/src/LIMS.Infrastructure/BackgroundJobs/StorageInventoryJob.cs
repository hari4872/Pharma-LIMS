using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace LIMS.Infrastructure.BackgroundJobs;

// FR-19: StorageInventoryJob â€” nightly capacity audit across all storage locations
// Alerts LabManager when any location exceeds capacity threshold (from DB config)
// Interval from DB config (Contract 2 â€” not hardcoded)
public class StorageInventoryJob : BackgroundService
{
    private readonly IServiceProvider _services;
    private readonly ILogger<StorageInventoryJob> _logger;

    public StorageInventoryJob(IServiceProvider services, ILogger<StorageInventoryJob> logger)
    { _services = services; _logger = logger; }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try { await RunAsync(stoppingToken); }
            catch (Exception ex) when (ex is not OperationCanceledException)
            { _logger.LogError(ex, "[StorageInventoryJob] Unhandled error — job continues next interval"); }
            var intervalHours = await GetIntervalHoursAsync(stoppingToken);
            await Task.Delay(TimeSpan.FromHours(intervalHours), stoppingToken);
        }
    }

    private async Task RunAsync(CancellationToken ct)
    {
        using var scope = _services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<LimsDbContext>();
        var notifications = scope.ServiceProvider.GetRequiredService<INotificationService>();

        // Threshold from DB config (Contract 2 â€” not hardcoded)
        var thresholdPct = await GetCapacityThresholdPctAsync(db, ct);

        // LowStockThreshold = minimum retain count per location before alert
        var locations = await db.StorageLocations.Where(l => l.IsActive).ToListAsync(ct);

        var overCapacity = new List<object>();
        foreach (var loc in locations)
        {
            var occupancy = await db.RetainSamples
                .CountAsync(r => r.LocationId == loc.LocationId && r.DestroyedAt == null, ct);

            // Alert when occupancy exceeds capacity threshold (number of samples)
            // Use LowStockThreshold as minimum; alert when occupancy >= threshold * (thresholdPct/100)
            var alertLevel = loc.LowStockThreshold ?? 100; // fallback to 100 if not configured
            var pct = alertLevel > 0 ? (decimal)occupancy / alertLevel * 100 : 0;
            if (pct >= thresholdPct)
            {
                overCapacity.Add(new
                {
                    loc.LocationId,
                    loc.LocationCode,
                    AlertLevel = alertLevel,
                    Occupancy = occupancy,
                    OccupancyPct = Math.Round(pct, 1)
                });
            }
        }

        if (overCapacity.Count > 0)
        {
            _logger.LogWarning("StorageInventoryJob: {Count} storage location(s) at/above {Pct}% capacity",
                overCapacity.Count, thresholdPct);

            await notifications.PushToGroupAsync("LabManager", "StorageCapacityAlert", new
            {
                Count = overCapacity.Count,
                ThresholdPct = thresholdPct,
                Locations = overCapacity
            }, ct);
        }
    }

    private async Task<decimal> GetCapacityThresholdPctAsync(LimsDbContext db, CancellationToken ct)
    {
        var config = await db.LabConfigs.FirstOrDefaultAsync(c => c.ConfigKey == "storage_capacity_alert_pct", ct);
        if (config != null && decimal.TryParse(config.ConfigValue, out var p)) return p;
        return 80m; // 80% default â€” admin sets storage_capacity_alert_pct in LabConfig
    }

    private async Task<double> GetIntervalHoursAsync(CancellationToken ct)
    {
        try
        {
            using var scope = _services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<LimsDbContext>();
            var config = await db.LabConfigs.FirstOrDefaultAsync(c => c.ConfigKey == "storage_inventory_interval_hrs", ct);
            if (config != null && double.TryParse(config.ConfigValue, out var h)) return h;
        }
        catch { }
        return 24;
    }
}

