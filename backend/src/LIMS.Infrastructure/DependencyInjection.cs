using LIMS.Application.Interfaces;
using LIMS.Infrastructure.BackgroundJobs;
using LIMS.Infrastructure.Hubs;
using LIMS.Infrastructure.Persistence;
using LIMS.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace LIMS.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        // DB — Neon PostgreSQL via connection string only (Contract 1: DB-portable)
        services.AddDbContext<LimsDbContext>(options =>
            options.UseNpgsql(configuration.GetConnectionString("DefaultConnection"),
                npg => npg.MigrationsAssembly(typeof(LimsDbContext).Assembly.FullName)));

        services.AddScoped<ILimsDbContext>(sp => sp.GetRequiredService<LimsDbContext>());

        // Services (Contract 1: single named service per concern)
        services.AddScoped<IElectronicSignatureService, ElectronicSignatureService>();
        services.AddScoped<IMasterDataAuditService, MasterDataAuditService>();
        services.AddScoped<INotificationService, NotificationService>();
        services.AddScoped<IMasterDataValidatorService, MasterDataValidatorService>();
        // Phase 2 services
        services.AddScoped<ISampleIdFormatService, SampleIdFormatService>();
        services.AddScoped<IFormTemplateSelectorService, FormTemplateSelectorService>();
        services.AddScoped<ISampleValidatorService, SampleValidatorService>();
        // Phase 1b services
        services.AddScoped<ICheckpointTriggerService, CheckpointTriggerService>();
        // Phase 3 services
        services.AddScoped<IOosDetectionService, OosDetectionService>();
        services.AddScoped<IParameterCalculationService, ParameterCalculationService>();
        services.AddScoped<IAutoCorrectionService, AutoCorrectionService>();
        // Phase 4 services
        services.AddScoped<ICoAHeaderService, CoAHeaderService>();
        services.AddScoped<ICoAGenerationService, CoAGenerationService>();
        services.AddScoped<ICoADistributionService, CoADistributionService>();
        services.AddScoped<IQAReviewGateService, QAReviewGateService>();
        services.AddScoped<IDispatchEventService, DispatchEventService>();
        services.AddScoped<IDispatchStatusService, DispatchStatusService>();
        // Phase 5 services
        services.AddScoped<ITraceabilityQueryService, TraceabilityQueryService>();
        services.AddScoped<IExcursionImpactService, ExcursionImpactService>();
        services.AddScoped<IPullExecutionService, PullExecutionService>();

        // SignalR (Contract 2: all push from server)
        services.AddSignalR();

        // Background jobs (Contract 2: IHostedService — intervals from DB config)
        services.AddHostedService<CalibrationDueDateJob>();
        services.AddHostedService<TrainingExpiryJob>();
        // Phase 1b background jobs — all 4 trigger modes
        services.AddHostedService<CheckpointSchedulerJob>();
        services.AddHostedService<ProcessLogSchedulerJob>();
        services.AddHostedService<DispatchEventJob>();
        services.AddHostedService<MissedTriggerEscalationJob>();
        // Phase 3 background jobs
        services.AddHostedService<WorkQueueEscalationJob>();
        // Phase 5 background jobs
        services.AddHostedService<PullReminderJob>();
        services.AddHostedService<MissedPullJob>();
        services.AddHostedService<DestructionAlertJob>();

        return services;
    }
}
