using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace LIMS.Infrastructure.BackgroundJobs;

// Escalates InProgress executions past sample DueDate via SignalR (Contract 2: no polling in UI)
public class WorkQueueEscalationJob : BackgroundService
{
    private readonly IServiceProvider _services;
    private readonly ILogger<WorkQueueEscalationJob> _logger;

    public WorkQueueEscalationJob(IServiceProvider services, ILogger<WorkQueueEscalationJob> logger)
    { _services = services; _logger = logger; }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _services.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<ILimsDbContext>();
                var notify = scope.ServiceProvider.GetRequiredService<INotificationService>();

                var intervalMinutes = 30;
                var config = await db.LabConfigs.FirstOrDefaultAsync(
                    c => c.ConfigKey == "work_queue_escalation_minutes", stoppingToken);
                if (config is not null && int.TryParse(config.ConfigValue, out var v)) intervalMinutes = v;

                var now = DateTimeOffset.UtcNow;
                var overdue = await db.TestExecutions
                    .Include(e => e.Sample)
                    .Include(e => e.Analyst)
                    .Where(e => (e.Status == TestExecutionStatus.Assigned || e.Status == TestExecutionStatus.InProgress)
                                && e.Sample.DueDate.HasValue
                                && e.Sample.DueDate.Value < now)
                    .ToListAsync(stoppingToken);

                foreach (var execution in overdue)
                {
                    _logger.LogWarning("Work queue escalation: ExecutionId={Id} for Sample={Sample} is overdue.",
                        execution.ExecutionId, execution.Sample.SampleNumber);
                    await notify.PushToGroupAsync("LabManager", "WorkQueueOverdue",
                        new
                        {
                            executionId = execution.ExecutionId,
                            sampleId = execution.SampleId,
                            sampleNumber = execution.Sample.SampleNumber,
                            analystName = execution.Analyst.FullName,
                            dueDate = execution.Sample.DueDate
                        }, stoppingToken);
                }

                await Task.Delay(TimeSpan.FromMinutes(intervalMinutes), stoppingToken);
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex) { _logger.LogError(ex, "WorkQueueEscalationJob error."); await Task.Delay(60_000, stoppingToken); }
        }
    }
}
