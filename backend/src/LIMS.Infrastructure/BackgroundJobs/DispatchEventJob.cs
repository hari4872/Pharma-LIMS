using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace LIMS.Infrastructure.BackgroundJobs;

// Mode 4: DO-triggered — polls for pending dispatch orders and triggers outgoing QC checkpoints (FR-15, FR-16)
// Test set configurable per product type in Master Data — not hardcoded (Contract 2)
public class DispatchEventJob : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<DispatchEventJob> _logger;

    public DispatchEventJob(IServiceScopeFactory scopeFactory, ILogger<DispatchEventJob> logger)
    { _scopeFactory = scopeFactory; _logger = logger; }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var scope = _scopeFactory.CreateAsyncScope();
                var db = scope.ServiceProvider.GetRequiredService<ILimsDbContext>();
                var triggerSvc = scope.ServiceProvider.GetRequiredService<ICheckpointTriggerService>();
                var notifications = scope.ServiceProvider.GetRequiredService<INotificationService>();

                // Interval from DB config (Contract 2)
                var intervalConfig = await db.LabConfigs
                    .FirstOrDefaultAsync(c => c.ConfigKey == "dispatch_event_poll_minutes", stoppingToken);
                var intervalMinutes = int.TryParse(intervalConfig?.ConfigValue, out var m) ? m : 5;

                // Find dispatch-event checkpoints — Mode 4 (FR-16)
                var dispatchCheckpoints = await db.Checkpoints
                    .Where(c => c.TriggerMode == TriggerType.DispatchEvent && c.IsActive)
                    .ToListAsync(stoppingToken);

                foreach (var cp in dispatchCheckpoints)
                {
                    await triggerSvc.TriggerAsync(cp.CheckpointId, "DispatchEvent", "System", ct: stoppingToken);
                    await notifications.PushToGroupAsync("QA", "DispatchQCTriggered",
                        new { cp.CheckpointId, cp.CheckpointCode }, stoppingToken);
                }

                await Task.Delay(TimeSpan.FromMinutes(intervalMinutes), stoppingToken);
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex) { _logger.LogError(ex, "DispatchEventJob error"); await Task.Delay(300000, stoppingToken); }
        }
    }
}
