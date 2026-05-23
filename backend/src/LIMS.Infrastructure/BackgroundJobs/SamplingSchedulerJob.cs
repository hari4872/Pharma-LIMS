using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace LIMS.Infrastructure.BackgroundJobs;

/// <summary>
/// Sprint 4 — Sampling Scheduler Job
/// Daily at 01:00 UTC: evaluates active SamplingPlans and pushes sampling reminders
/// via SignalR to the relevant lab groups.
///
/// Pharma pattern: the job triggers the notification — the analyst creates the sample.
/// This preserves the ALCOA+ attributable chain (human authorises the sample creation).
/// </summary>
public class SamplingSchedulerJob : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<SamplingSchedulerJob> _logger;
    private static readonly TimeSpan Interval = TimeSpan.FromHours(24);

    public SamplingSchedulerJob(IServiceScopeFactory factory, ILogger<SamplingSchedulerJob> logger)
    { _scopeFactory = factory; _logger = logger; }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // First run near 01:00 UTC
        var now     = DateTimeOffset.UtcNow;
        var nextRun = now.Date.AddHours(1) > now.DateTime
            ? now.Date.AddHours(1)
            : now.Date.AddDays(1).AddHours(1);
        var delay = (DateTimeOffset)nextRun - now;
        if (delay > TimeSpan.Zero)
            await Task.Delay(delay, stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try { await RunAsync(stoppingToken); }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "[SamplingSchedulerJob] Error during scheduled run");
            }
            await Task.Delay(Interval, stoppingToken);
        }
    }

    private async Task RunAsync(CancellationToken ct)
    {
        using var scope  = _scopeFactory.CreateScope();
        var db    = scope.ServiceProvider.GetRequiredService<ILimsDbContext>();
        var notify = scope.ServiceProvider.GetRequiredService<INotificationService>();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var plans = await db.SamplingPlans
            .Include(p => p.Material)
            .Include(p => p.SampleType)
            .Where(p => p.IsActive)
            .ToListAsync(ct);

        int triggered = 0;
        foreach (var plan in plans)
        {
            bool dueToday = plan.Frequency switch
            {
                FrequencyType.Daily          => true,
                FrequencyType.Shift          => true,
                FrequencyType.Weekly         => today.DayOfWeek == DayOfWeek.Monday,
                FrequencyType.Monthly        => today.Day == 1,
                FrequencyType.Environmental  => today.DayOfWeek == DayOfWeek.Monday || today.DayOfWeek == DayOfWeek.Thursday,
                _ => false   // Hourly/Event/Batch/Stability require explicit triggers
            };

            if (!dueToday) continue;

            // Check if a sample was already registered today for this material+type
            var alreadyDone = await db.Samples.AnyAsync(s =>
                s.MaterialId == plan.MaterialId &&
                s.SampleTypeId == plan.SampleTypeId &&
                s.CreatedAt >= DateTimeOffset.UtcNow.Date, ct);

            if (alreadyDone) continue;

            // Push sampling reminder to all analysts (AllUsers group)
            var msg = $"Sampling due: {plan.PlanName} — {plan.Material.MaterialName} " +
                      $"({plan.SampleType.TypeName}) × {plan.SamplesPerPull} unit(s). Please register sample.";

            await notify.PushToGroupAsync("AllUsers", "SamplingDue",
                new { planId = plan.SamplingPlanId, planName = plan.PlanName, msg }, ct);

            triggered++;
        }

        if (triggered > 0)
            _logger.LogInformation("[SamplingSchedulerJob] Sent {Count} sampling reminders", triggered);
    }
}
