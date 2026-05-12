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

        // SignalR (Contract 2: all push from server)
        services.AddSignalR();

        // Background jobs (Contract 2: IHostedService — intervals from DB config)
        services.AddHostedService<CalibrationDueDateJob>();
        services.AddHostedService<TrainingExpiryJob>();

        return services;
    }
}
