using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace LIMS.Infrastructure.BackgroundJobs;

// FR-06: Missed trigger escalation — server-side job (Contract 2)
// Checks for Process Log rows that passed their slot time without being signed
public class MissedTriggerEscalationJob : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<MissedTriggerEscalationJob> _logger;

    public MissedTriggerEscalationJob(IServiceScopeFactory scopeFactory, ILogger<MissedTriggerEscalationJob> logger)
    { _scopeFactory = scopeFactory; _logger = logger; }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var scope = _scopeFactory.CreateAsyncScope();
                var db = scope.ServiceProvider.GetRequiredService<ILimsDbContext>();
                var notifications = scope.ServiceProvider.GetRequiredService<INotificationService>();

                var intervalConfig = await db.LabConfigs
                    .FirstOrDefaultAsync(c => c.ConfigKey == "missed_trigger_check_minutes", stoppingToken);
                var intervalMinutes = int.TryParse(intervalConfig?.ConfigValue, out var m) ? m : 30;

                var gracePeriodConfig = await db.LabConfigs
                    .FirstOrDefaultAsync(c => c.ConfigKey == "missed_trigger_grace_minutes", stoppingToken);
                var gracePeriodMinutes = int.TryParse(gracePeriodConfig?.ConfigValue, out var g) ? g : 15;

                var cutoff = DateTimeOffset.UtcNow.AddMinutes(-gracePeriodMinutes);

                // Find Open rows past their slot time + grace period
                var missedRows = await db.ProcessLogRows
                    .Include(r => r.Checkpoint)
                    .Where(r => r.Status == "Open" && r.SlotTime <= cutoff)
                    .ToListAsync(stoppingToken);

                foreach (var row in missedRows)
                {
                    _logger.LogWarning("Missed Process Log slot: Checkpoint {Code} slot {Slot}",
                        row.Checkpoint.CheckpointCode, row.SlotLabel);
                    await notifications.PushToGroupAsync("LabManager", "MissedCheckpointTrigger",
                        new { row.CheckpointId, row.Checkpoint.CheckpointCode, row.SlotLabel, row.SlotTime }, stoppingToken);
                }

                await Task.Delay(TimeSpan.FromMinutes(intervalMinutes), stoppingToken);
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex) { _logger.LogError(ex, "MissedTriggerEscalationJob error"); await Task.Delay(1800000, stoppingToken); }
        }
    }
}
