using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace LIMS.Infrastructure.BackgroundJobs;

// Mode 3: shift-based — pre-populates ProcessLogRow time slots for the day (FR-11, Contract 2)
public class ProcessLogSchedulerJob : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<ProcessLogSchedulerJob> _logger;

    public ProcessLogSchedulerJob(IServiceScopeFactory scopeFactory, ILogger<ProcessLogSchedulerJob> logger)
    { _scopeFactory = scopeFactory; _logger = logger; }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var scope = _scopeFactory.CreateAsyncScope();
                var db = scope.ServiceProvider.GetRequiredService<ILimsDbContext>();

                var today = DateOnly.FromDateTime(DateTime.UtcNow);
                var processLogCheckpoints = await db.Checkpoints
                    .Where(c => c.TriggerMode == TriggerType.ProcessLog && c.IsActive && c.ShiftIntervalHrs.HasValue)
                    .ToListAsync(stoppingToken);

                foreach (var cp in processLogCheckpoints)
                {
                    var intervalHrs = cp.ShiftIntervalHrs!.Value;
                    var startOfDay = today.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

                    // Build all slot times for today based on shift interval
                    var slots = new List<DateTimeOffset>();
                    for (var t = startOfDay; t < startOfDay.AddDays(1); t = t.AddHours(intervalHrs))
                        slots.Add(new DateTimeOffset(t, TimeSpan.Zero));

                    foreach (var slotTime in slots)
                    {
                        var slotLabel = slotTime.ToString("HH:mm");
                        var exists = await db.ProcessLogRows.AnyAsync(
                            r => r.CheckpointId == cp.CheckpointId && r.SlotTime == slotTime, stoppingToken);
                        if (exists) continue;

                        db.ProcessLogRows.Add(new ProcessLogRow
                        {
                            CheckpointId = cp.CheckpointId,
                            SlotTime = slotTime,
                            SlotLabel = slotLabel,
                            Status = "Open"
                        });
                    }
                }

                await db.SaveChangesAsync(stoppingToken);
                _logger.LogInformation("ProcessLogSchedulerJob: pre-populated rows for {Date}", today);

                // Run once per day at midnight UTC — interval from DB config (Contract 2)
                var nextRun = DateTime.UtcNow.Date.AddDays(1) - DateTime.UtcNow;
                await Task.Delay(nextRun, stoppingToken);
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex) { _logger.LogError(ex, "ProcessLogSchedulerJob error"); await Task.Delay(3600000, stoppingToken); }
        }
    }
}
