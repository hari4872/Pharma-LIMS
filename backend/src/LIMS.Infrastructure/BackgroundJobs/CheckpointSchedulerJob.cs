using LIMS.Application.Features.EmSamples;
using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace LIMS.Infrastructure.BackgroundJobs;

// Mode 1: time-based trigger — IHostedService, interval from DB config (Contract 2, FR-02, 21 CFR 211.68)
public class CheckpointSchedulerJob : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<CheckpointSchedulerJob> _logger;

    public CheckpointSchedulerJob(IServiceScopeFactory scopeFactory, ILogger<CheckpointSchedulerJob> logger)
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

                // Interval from DB config (Contract 2 — never hardcoded)
                var intervalConfig = await db.LabConfigs
                    .FirstOrDefaultAsync(c => c.ConfigKey == "checkpoint_scheduler_interval_minutes", stoppingToken);
                var intervalMinutes = int.TryParse(intervalConfig?.ConfigValue, out var m) ? m : 1;

                var now = DateTimeOffset.UtcNow;
                var activeCheckpoints = await db.Checkpoints
                    .Where(c => c.TriggerMode == TriggerType.TimeBased && c.IsActive && c.TimeSlots != null)
                    .ToListAsync(stoppingToken);

                bool anyEmTriggered = false;
                foreach (var cp in activeCheckpoints)
                {
                    // TimeSlots stored as JSONB array of "HH:mm" strings
                    if (cp.TimeSlots is null) continue;
                    var slots = System.Text.Json.JsonSerializer.Deserialize<string[]>(cp.TimeSlots) ?? [];
                    var currentSlot = now.ToString("HH:mm");

                    if (slots.Contains(currentSlot))
                    {
                        await triggerSvc.TriggerAsync(cp.CheckpointId, "TimeBased", "System", ct: stoppingToken);
                        await notifications.PushToGroupAsync("Analyst", "CheckpointTriggered",
                            new { cp.CheckpointId, cp.CheckpointCode, TriggerMode = "TimeBased" }, stoppingToken);
                        _logger.LogInformation("Checkpoint {Code} triggered at {Time} (Mode 1 Time-Based)", cp.CheckpointCode, now);

                        if (cp.Category == "Environmental")
                            anyEmTriggered = true;
                    }
                }

                // Auto-generate EM samples when any Environmental checkpoint fires
                if (anyEmTriggered)
                {
                    var mediator = scope.ServiceProvider.GetRequiredService<IMediator>();
                    var today = DateOnly.FromDateTime(DateTime.UtcNow);
                    var result = await mediator.Send(new GenerateEmSamplesCommand(today, "System"), stoppingToken);
                    if (result.IsSuccess)
                        _logger.LogInformation("[CheckpointSchedulerJob] Auto-generated {Count} EM sample(s) for {Date}", result.Value, today);
                    else
                        _logger.LogWarning("[CheckpointSchedulerJob] EM sample auto-generation skipped: {Error}", result.ErrorMessage);
                }

                await Task.Delay(TimeSpan.FromMinutes(intervalMinutes), stoppingToken);
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex) { _logger.LogError(ex, "CheckpointSchedulerJob error"); await Task.Delay(60000, stoppingToken); }
        }
    }
}
