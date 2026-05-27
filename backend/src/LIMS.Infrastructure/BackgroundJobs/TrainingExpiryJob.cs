using LIMS.Application.Interfaces;
using LIMS.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace LIMS.Infrastructure.BackgroundJobs;

// Contract 2: IHostedService — daily check, interval from DB config
// 21 CFR §11.10(i): expired training = hard block — enforced at test gate
public class TrainingExpiryJob : BackgroundService
{
    private readonly IServiceProvider _services;
    private readonly ILogger<TrainingExpiryJob> _logger;

    public TrainingExpiryJob(IServiceProvider services, ILogger<TrainingExpiryJob> logger)
    { _services = services; _logger = logger; }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await RunAsync(stoppingToken);
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex)
            {
                _logger.LogError(ex, "TrainingExpiryJob: run failed — will retry in 24 hours.");
            }

            try { await Task.Delay(TimeSpan.FromHours(24), stoppingToken); }
            catch (OperationCanceledException) { break; }
        }
    }

    private async Task RunAsync(CancellationToken cancellationToken)
    {
        using var scope = _services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<LimsDbContext>();
        var notifications = scope.ServiceProvider.GetRequiredService<INotificationService>();

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var alertDate = today.AddDays(7);

        // T-7 training expiry alerts
        var expiringSoon = await db.UserTrainingRecords
            .Include(t => t.User)
            .Include(t => t.Method)
            .Where(t => t.ValidUntil == alertDate)
            .ToListAsync(cancellationToken);

        foreach (var record in expiringSoon)
        {
            await notifications.PushToUserAsync(record.UserId, "TrainingExpiringSoon",
                new { record.TrainingId, record.Method.MethodCode, record.Method.MethodName, record.ValidUntil, DaysRemaining = 7 },
                cancellationToken);
            _logger.LogInformation("Training expiry alert sent for user {User} method {Method}", record.User.Username, record.Method.MethodCode);
        }
    }
}
