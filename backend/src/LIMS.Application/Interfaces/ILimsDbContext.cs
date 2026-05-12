using LIMS.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Interfaces;

public interface ILimsDbContext
{
    DbSet<Laboratory> Laboratories { get; }
    DbSet<User> Users { get; }
    DbSet<ElectronicSignature> ElectronicSignatures { get; }
    DbSet<Instrument> Instruments { get; }
    DbSet<CalibrationRecord> CalibrationRecords { get; }
    DbSet<InstrumentBreakdown> InstrumentBreakdowns { get; }
    DbSet<InstrumentRepair> InstrumentRepairs { get; }
    DbSet<Material> Materials { get; }
    DbSet<TestMethod> TestMethods { get; }
    DbSet<ParameterLookupTable> ParameterLookupTables { get; }
    DbSet<ParameterLookupRow> ParameterLookupRows { get; }
    DbSet<TestMethodParameter> TestMethodParameters { get; }
    DbSet<SpecLimit> SpecLimits { get; }
    DbSet<FormTemplate> FormTemplates { get; }
    DbSet<FormTemplateLocation> FormTemplateLocations { get; }
    DbSet<FormTemplateParameter> FormTemplateParameters { get; }
    DbSet<LabConfig> LabConfigs { get; }
    DbSet<UserTrainingRecord> UserTrainingRecords { get; }
    DbSet<MasterDataAuditLog> MasterDataAuditLogs { get; }
    DbSet<SampleType> SampleTypes { get; }
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
