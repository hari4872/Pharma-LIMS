using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using LIMS.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace LIMS.Infrastructure.BackgroundJobs;

// FR-17: FormTemplateApprovalJob â€” alerts QA when form templates remain in Draft/UnderReview
// EU Annex 11 Â§10: form templates must be reviewed and approved before use
// Interval from DB config (Contract 2 â€” not hardcoded)
public class FormTemplateApprovalJob : BackgroundService
{
    private readonly IServiceProvider _services;
    private readonly ILogger<FormTemplateApprovalJob> _logger;

    public FormTemplateApprovalJob(IServiceProvider services, ILogger<FormTemplateApprovalJob> logger)
    { _services = services; _logger = logger; }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try { await RunAsync(stoppingToken); }
            catch (Exception ex) when (ex is not OperationCanceledException)
            { _logger.LogError(ex, "[FormTemplateApprovalJob] Unhandled error — job continues next interval"); }
            var intervalHours = await GetIntervalHoursAsync(stoppingToken);
            await Task.Delay(TimeSpan.FromHours(intervalHours), stoppingToken);
        }
    }

    private async Task RunAsync(CancellationToken ct)
    {
        using var scope = _services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<LimsDbContext>();
        var notifications = scope.ServiceProvider.GetRequiredService<INotificationService>();

        // Templates that have been in Draft/UnderReview longer than the stale threshold
        var thresholdDays = await GetStaleDaysAsync(db, ct);
        var cutoff = DateTimeOffset.UtcNow.AddDays(-thresholdDays);

        var staleTemplates = await db.FormTemplates
            .Where(t => t.Status == FormTemplateStatus.Draft && t.CreatedAt <= cutoff)
            .ToListAsync(ct);

        if (staleTemplates.Count > 0)
        {
            _logger.LogWarning("FormTemplateApprovalJob: {Count} form template(s) pending review for >{Days}d",
                staleTemplates.Count, thresholdDays);

            await notifications.PushToGroupAsync("QA", "FormTemplatePendingApproval", new
            {
                Count = staleTemplates.Count,
                StaleDays = thresholdDays,
                Templates = staleTemplates.Select(t => new { t.FormTemplateId, t.FormName, t.Status, t.CreatedAt })
            }, ct);
        }
    }

    private async Task<int> GetStaleDaysAsync(LimsDbContext db, CancellationToken ct)
    {
        var config = await db.LabConfigs.FirstOrDefaultAsync(c => c.ConfigKey == "form_template_stale_days", ct);
        if (config != null && int.TryParse(config.ConfigValue, out var d)) return d;
        return 7; // default: alert after 7 days pending â€” admin sets form_template_stale_days in LabConfig
    }

    private async Task<double> GetIntervalHoursAsync(CancellationToken ct)
    {
        try
        {
            using var scope = _services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<LimsDbContext>();
            var config = await db.LabConfigs.FirstOrDefaultAsync(c => c.ConfigKey == "form_template_check_interval_hrs", ct);
            if (config != null && double.TryParse(config.ConfigValue, out var h)) return h;
        }
        catch { }
        return 24;
    }
}

