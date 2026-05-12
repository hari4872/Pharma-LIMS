using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Infrastructure.Persistence;

public class LimsDbContext : DbContext, ILimsDbContext
{
    public LimsDbContext(DbContextOptions<LimsDbContext> options) : base(options) { }

    // Phase 1 — Master Data
    public DbSet<Laboratory> Laboratories => Set<Laboratory>();
    public DbSet<User> Users => Set<User>();
    public DbSet<ElectronicSignature> ElectronicSignatures => Set<ElectronicSignature>();
    public DbSet<Instrument> Instruments => Set<Instrument>();
    public DbSet<CalibrationRecord> CalibrationRecords => Set<CalibrationRecord>();
    public DbSet<InstrumentBreakdown> InstrumentBreakdowns => Set<InstrumentBreakdown>();
    public DbSet<InstrumentRepair> InstrumentRepairs => Set<InstrumentRepair>();
    public DbSet<Material> Materials => Set<Material>();
    public DbSet<TestMethod> TestMethods => Set<TestMethod>();
    public DbSet<ParameterLookupTable> ParameterLookupTables => Set<ParameterLookupTable>();
    public DbSet<ParameterLookupRow> ParameterLookupRows => Set<ParameterLookupRow>();
    public DbSet<TestMethodParameter> TestMethodParameters => Set<TestMethodParameter>();
    public DbSet<SpecLimit> SpecLimits => Set<SpecLimit>();
    public DbSet<FormTemplate> FormTemplates => Set<FormTemplate>();
    public DbSet<FormTemplateLocation> FormTemplateLocations => Set<FormTemplateLocation>();
    public DbSet<FormTemplateParameter> FormTemplateParameters => Set<FormTemplateParameter>();
    public DbSet<LabConfig> LabConfigs => Set<LabConfig>();
    public DbSet<UserTrainingRecord> UserTrainingRecords => Set<UserTrainingRecord>();
    public DbSet<MasterDataAuditLog> MasterDataAuditLogs => Set<MasterDataAuditLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(LimsDbContext).Assembly);

        // All enums stored as strings for readability
        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            foreach (var property in entityType.GetProperties())
            {
                if (property.ClrType.IsEnum)
                {
                    var converterType = typeof(EnumToStringConverter<>).MakeGenericType(property.ClrType);
                    var converter = Activator.CreateInstance(converterType);
                    property.SetValueConverter((Microsoft.EntityFrameworkCore.Storage.ValueConversion.ValueConverter)converter!);
                }
            }
        }
    }
}

// Generic enum-to-string converter
public class EnumToStringConverter<TEnum> : Microsoft.EntityFrameworkCore.Storage.ValueConversion.ValueConverter<TEnum, string>
    where TEnum : struct, Enum
{
    public EnumToStringConverter()
        : base(v => v.ToString(), v => Enum.Parse<TEnum>(v)) { }
}
