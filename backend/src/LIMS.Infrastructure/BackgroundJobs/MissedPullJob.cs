using LIMS.Application.Interfaces;
using LIMS.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace LIMS.Infrastructure.BackgroundJobs;

// FR-04: MissedPullJob — escalates missed stability pulls server-side (Contract 2)
// Missed = DueDate < today AND Status = Pending â†’ escalate to QA
public class MissedPullJob : BackgroundService
{
    private readonly IServiceProvider _services;
    private readonly ILogger<MissedPullJob> _logger;

    public MissedPullJob(IServiceProvider services, ILogger<MissedPullJob> logger)
    { _services = services; _logger = logger; }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try { await RunAsync(stoppingToken); }
            catch (Exception ex) when (ex is not OperationCanceledException)
            { _logger.LogError(ex, "[MissedPullJob] Unhandled error — job continues next interval"); }
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

        var missedPulls = await db.StabilityPulls
            .Include(p => p.Sample).ThenInclude(s => s.Material)
            .Where(p => p.Status == "Pending" && p.DueDate < today)
            .ToListAsync(ct);

        foreach (var pull in missedPulls)
        {
            pull.Status = "Missed";
            _logger.LogWarning("MissedPullJob: Pull {PullId} for {SampleNumber} at time-point {TimePoint} missed (due {DueDate})",
                pull.PullId, pull.Sample.SampleNumber, pull.TimePoint, pull.DueDate);
        }

        if (missedPulls.Count > 0)
        {
            await db.SaveChangesAsync(ct);
            await notifications.PushToGroupAsync("QA", "PullsMissed", new
            {
                Count = missedPulls.Count,
                Pulls = missedPulls.Select(p => new
                {
                    p.PullId, p.SampleId,
                    SampleNumber = p.Sample.SampleNumber,
                    MaterialName = p.Sample.Material.MaterialName,
                    p.TimePoint, p.DueDate
                })
            }, ct);
        }
    }

    private async Task<double> GetIntervalHoursAsync(CancellationToken ct)
    {
        try
        {
            using var scope = _services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<LimsDbContext>();
            var config = await db.LabConfigs.FirstOrDefaultAsync(c => c.ConfigKey == "missed_pull_check_interval_hrs", ct);
            if (config != null && double.TryParse(config.ConfigValue, out var h)) return h;
        }
        catch { }
        return 24;
    }
}

