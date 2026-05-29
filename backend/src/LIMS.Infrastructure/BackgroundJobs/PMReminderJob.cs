using LIMS.Application.Interfaces;
using LIMS.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace LIMS.Infrastructure.BackgroundJobs;

// FR-14: PMReminderJob â€” T-7 and T-1 preventive maintenance due date alerts
// PM interval from DB config (Contract 2 â€” no hardcoding)
public class PMReminderJob : BackgroundService
{
    private readonly IServiceProvider _services;
    private readonly ILogger<PMReminderJob> _logger;

    public PMReminderJob(IServiceProvider services, ILogger<PMReminderJob> logger)
    { _services = services; _logger = logger; }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try { await RunAsync(stoppingToken); }
            catch (Exception ex) when (ex is not OperationCanceledException)
            { _logger.LogError(ex, "[PMReminderJob] Unhandled error — job continues next interval"); }
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

        // PM due = calibration_due approaching (instruments with Maintenance or Available status)
        foreach (var days in new[] { 7, 1 })
        {
            var alertDate = today.AddDays(days);
            var dueInstruments = await db.Instruments
                .Where(i => i.IsActive && i.CalibrationDue == alertDate)
                .ToListAsync(ct);

            if (dueInstruments.Count > 0)
            {
                _logger.LogInformation("PMReminderJob: {Count} instruments PM due in {Days} day(s)", dueInstruments.Count, days);
                await notifications.PushToGroupAsync("QA", "PmDueSoon", new
                {
                    DaysRemaining = days,
                    Instruments = dueInstruments.Select(i => new { i.InstrumentId, i.InstrumentCode, i.CalibrationDue })
                }, ct);
            }
        }
    }

    private async Task<double> GetIntervalHoursAsync(CancellationToken ct)
    {
        try
        {
            using var scope = _services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<LimsDbContext>();
            var config = await db.LabConfigs.FirstOrDefaultAsync(c => c.ConfigKey == "pm_reminder_interval_hrs", ct);
            if (config != null && double.TryParse(config.ConfigValue, out var h)) return h;
        }
        catch { }
        return 24;
    }
}

