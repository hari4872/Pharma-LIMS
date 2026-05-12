using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using LIMS.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace LIMS.Infrastructure.BackgroundJobs;

// Contract 2: IHostedService — runs server-side daily, interval from DB config (not hardcoded)
public class CalibrationDueDateJob : BackgroundService
{
    private readonly IServiceProvider _services;
    private readonly ILogger<CalibrationDueDateJob> _logger;

    public CalibrationDueDateJob(IServiceProvider services, ILogger<CalibrationDueDateJob> logger)
    { _services = services; _logger = logger; }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            await RunAsync(stoppingToken);
            // Interval from DB config — default 24h, never hardcoded (Contract 2)
            var intervalHours = await GetIntervalHoursAsync(stoppingToken);
            await Task.Delay(TimeSpan.FromHours(intervalHours), stoppingToken);
        }
    }

    private async Task RunAsync(CancellationToken cancellationToken)
    {
        using var scope = _services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<LimsDbContext>();
        var notifications = scope.ServiceProvider.GetRequiredService<INotificationService>();

        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        // Flag OOC: cal_due < today
        var oocInstruments = await db.Instruments
            .Where(i => i.IsActive && i.CalibrationDue < today && i.Status != InstrumentStatus.OutOfCalibration)
            .ToListAsync(cancellationToken);

        foreach (var inst in oocInstruments)
        {
            inst.Status = InstrumentStatus.OutOfCalibration;
            _logger.LogWarning("Instrument {Code} is OutOfCalibration (due {Due})", inst.InstrumentCode, inst.CalibrationDue);
        }

        if (oocInstruments.Count > 0)
        {
            await db.SaveChangesAsync(cancellationToken);
            await notifications.PushToGroupAsync("QA", "InstrumentsOOC",
                new { Count = oocInstruments.Count, Instruments = oocInstruments.Select(i => new { i.InstrumentId, i.InstrumentCode }) },
                cancellationToken);
        }

        // T-7 and T-1 calibration due alerts
        var alertDays = new[] { 7, 1 };
        foreach (var days in alertDays)
        {
            var alertDate = today.AddDays(days);
            var dueInstruments = await db.Instruments
                .Where(i => i.IsActive && i.CalibrationDue == alertDate)
                .ToListAsync(cancellationToken);

            if (dueInstruments.Count > 0)
                await notifications.PushToGroupAsync("QA", "CalibrationDueSoon",
                    new { DaysRemaining = days, Instruments = dueInstruments.Select(i => new { i.InstrumentId, i.InstrumentCode, i.CalibrationDue }) },
                    cancellationToken);
        }
    }

    private async Task<double> GetIntervalHoursAsync(CancellationToken cancellationToken)
    {
        try
        {
            using var scope = _services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<LimsDbContext>();
            var config = await db.LabConfigs.FirstOrDefaultAsync(c => c.ConfigKey == "cal_check_interval_hrs", cancellationToken);
            if (config is not null && double.TryParse(config.ConfigValue, out var hours)) return hours;
        }
        catch { /* default fallback */ }
        return 24;
    }
}
