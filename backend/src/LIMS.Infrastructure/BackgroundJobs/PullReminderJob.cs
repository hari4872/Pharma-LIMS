using LIMS.Application.Interfaces;
using LIMS.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace LIMS.Infrastructure.BackgroundJobs;

// FR-03: PullReminderJob — T-7 and T-1 pull due date reminders (IHostedService — Contract 2)
// Interval from DB config — no hardcoding (Contract 2)
public class PullReminderJob : BackgroundService
{
    private readonly IServiceProvider _services;
    private readonly ILogger<PullReminderJob> _logger;

    public PullReminderJob(IServiceProvider services, ILogger<PullReminderJob> logger)
    { _services = services; _logger = logger; }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try { await RunAsync(stoppingToken); }
            catch (Exception ex) when (ex is not OperationCanceledException)
            { _logger.LogError(ex, "[PullReminderJob] Unhandled error — job continues next interval"); }
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

        // T-7 and T-1 reminder alerts (ICH Q1A)
        foreach (var days in new[] { 7, 1 })
        {
            var alertDate = today.AddDays(days);
            var pendingPulls = await db.StabilityPulls
                .Include(p => p.Sample).ThenInclude(s => s.Material)
                .Where(p => p.Status == "Pending" && p.DueDate == alertDate)
                .ToListAsync(ct);

            if (pendingPulls.Count > 0)
            {
                _logger.LogInformation("PullReminderJob: {Count} pulls due in {Days} day(s)", pendingPulls.Count, days);
                await notifications.PushToGroupAsync("Analyst", "PullDueSoon", new
                {
                    DaysRemaining = days,
                    Pulls = pendingPulls.Select(p => new
                    {
                        p.PullId, p.SampleId,
                        SampleNumber = p.Sample.SampleNumber,
                        MaterialName = p.Sample.Material.MaterialName,
                        p.TimePoint, p.DueDate, p.RequiredQty, p.RequiredQtyUom
                    })
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
            var config = await db.LabConfigs.FirstOrDefaultAsync(c => c.ConfigKey == "pull_reminder_interval_hrs", ct);
            if (config != null && double.TryParse(config.ConfigValue, out var h)) return h;
        }
        catch { }
        return 12;
    }
}

