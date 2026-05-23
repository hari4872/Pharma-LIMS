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
    public DbSet<SampleType> SampleTypes => Set<SampleType>();
    public DbSet<ReagentStandard> ReagentStandards => Set<ReagentStandard>();
    // Phase 2
    public DbSet<Sample> Samples => Set<Sample>();
    public DbSet<BarcodePrintLog> BarcodePrintLogs => Set<BarcodePrintLog>();
    // Phase 1b
    public DbSet<Checkpoint> Checkpoints => Set<Checkpoint>();
    public DbSet<CheckpointLocation> CheckpointLocations => Set<CheckpointLocation>();
    public DbSet<CheckpointTriggerLog> CheckpointTriggerLogs => Set<CheckpointTriggerLog>();
    public DbSet<ProcessLogRow> ProcessLogRows => Set<ProcessLogRow>();
    public DbSet<CheckpointParameter> CheckpointParameters => Set<CheckpointParameter>();
    // Phase 2 join tables
    public DbSet<SampleCheckpoint> SampleCheckpoints => Set<SampleCheckpoint>();
    // Phase 3: Testing Execution + Digital Logbook
    public DbSet<TestExecution> TestExecutions => Set<TestExecution>();
    public DbSet<DigitalLogbookEntry> DigitalLogbookEntries => Set<DigitalLogbookEntry>();
    public DbSet<OosInvestigation> OosInvestigations => Set<OosInvestigation>();
    public DbSet<ResultsReview> ResultsReviews => Set<ResultsReview>();
    public DbSet<ResultEvidence> ResultEvidences => Set<ResultEvidence>();
    // Phase 4: CoA Generation + QA Review + Dispatch QC
    public DbSet<DeliveryOrder> DeliveryOrders => Set<DeliveryOrder>();
    public DbSet<Coa> Coas => Set<Coa>();
    public DbSet<CoaLine> CoaLines => Set<CoaLine>();
    public DbSet<CoaDistributionLog> CoaDistributionLogs => Set<CoaDistributionLog>();
    public DbSet<CoaApproval> CoaApprovals => Set<CoaApproval>();
    public DbSet<DispatchQcTask> DispatchQcTasks => Set<DispatchQcTask>();
    // Phase 5: Traceability
    public DbSet<SamplingEvent> SamplingEvents => Set<SamplingEvent>();
    public DbSet<ComplaintsDeviation> ComplaintsDeviations => Set<ComplaintsDeviation>();
    public DbSet<TraceQueryLog> TraceQueryLogs => Set<TraceQueryLog>();
    // Phase 5: Sample Inventory & Pull Planning
    public DbSet<StorageLocation> StorageLocations => Set<StorageLocation>();
    public DbSet<StorageTransferLog> StorageTransferLogs => Set<StorageTransferLog>();
    public DbSet<ConditionExcursion> ConditionExcursions => Set<ConditionExcursion>();
    public DbSet<ExcursionAffectedSample> ExcursionAffectedSamples => Set<ExcursionAffectedSample>();
    public DbSet<StabilityPull> StabilityPulls => Set<StabilityPull>();
    public DbSet<ShortPullDeviation> ShortPullDeviations => Set<ShortPullDeviation>();
    public DbSet<RetainSample> RetainSamples => Set<RetainSample>();
    // Phase 6: Instrument Management v1.2
    public DbSet<InstrumentUtilisationSummary> InstrumentUtilisationSummaries => Set<InstrumentUtilisationSummary>();
    // Phase 7: Dashboards
    public DbSet<TatBreachLog> TatBreachLogs => Set<TatBreachLog>();
    // Phase 8: Compliance & Governance
    public DbSet<ValidationReviewLog> ValidationReviewLogs => Set<ValidationReviewLog>();

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
