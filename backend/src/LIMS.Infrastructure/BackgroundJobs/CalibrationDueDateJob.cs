using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using LIMS.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace LIMS.Infrastructure.BackgroundJobs;

// Contract 2: IHostedService — runs server-side daily, interval from DB config (not hardcoded)
// Contract 1: status transitions go via IInstrumentStatusService — no direct Status mutation here
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
            try
            {
                await RunAsync(stoppingToken);
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex)
            {
                _logger.LogError(ex, "CalibrationDueDateJob: run failed — will retry next interval.");
            }

            try
            {
                var intervalHours = await GetIntervalHoursAsync(stoppingToken);
                await Task.Delay(TimeSpan.FromHours(intervalHours), stoppingToken);
            }
            catch (OperationCanceledException) { break; }
        }
    }

    private async Task RunAsync(CancellationToken ct)
    {
        using var scope = _services.CreateScope();
        var db            = scope.ServiceProvider.GetRequiredService<LimsDbContext>();
        var notifications = scope.ServiceProvider.GetRequiredService<INotificationService>();
        // Contract 1: IInstrumentStatusService owns ALL status transitions
        var statusService = scope.ServiceProvider.GetRequiredService<IInstrumentStatusService>();

        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        // Flag OOC: calibration_due < today AND not already OutOfCalibration
        var oocInstruments = await db.Instruments
            .Where(i => i.IsActive
                     && i.CalibrationDue < today
                     && i.Status != InstrumentStatus.OutOfCalibration)
            .ToListAsync(ct);

        foreach (var inst in oocInstruments)
        {
            // Contract 1: delegate status transition to IInstrumentStatusService
            await statusService.SetMaintenanceAsync(inst.InstrumentId,
                $"Calibration overdue since {inst.CalibrationDue}", ct);
            _logger.LogWarning("CalibrationDueDateJob: Instrument {Code} flagged OutOfCalibration (due {Due})",
                inst.InstrumentCode, inst.CalibrationDue);
        }

        if (oocInstruments.Count > 0)
            await notifications.PushToGroupAsync("QA", "CalibrationOOC",
                new { Count = oocInstruments.Count, Instruments = oocInstruments.Select(i => new { i.InstrumentId, i.InstrumentCode }) },
                ct);

        // T-7 and T-1 calibration due alerts
        foreach (var days in new[] { 7, 1 })
        {
            var alertDate = today.AddDays(days);
            var dueInstruments = await db.Instruments
                .Where(i => i.IsActive && i.CalibrationDue == alertDate)
                .ToListAsync(ct);

            if (dueInstruments.Count > 0)
                await notifications.PushToGroupAsync("QA", "CalibrationDueSoon",
                    new { DaysRemaining = days, Instruments = dueInstruments.Select(i => new { i.InstrumentId, i.InstrumentCode, i.CalibrationDue }) },
                    ct);
        }
    }

    private async Task<double> GetIntervalHoursAsync(CancellationToken ct)
    {
        try
        {
            using var scope = _services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<LimsDbContext>();
            var config = await db.LabConfigs.FirstOrDefaultAsync(c => c.ConfigKey == "cal_check_interval_hrs", ct);
            if (config is not null && double.TryParse(config.ConfigValue, out var hours)) return hours;
        }
        catch { }
        return 24;
    }
}
