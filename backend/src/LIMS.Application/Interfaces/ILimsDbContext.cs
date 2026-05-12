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
    // Phase 2: Sample Registration
    DbSet<Sample> Samples { get; }
    DbSet<BarcodePrintLog> BarcodePrintLogs { get; }
    // Phase 1b: Checkpoints
    DbSet<Checkpoint> Checkpoints { get; }
    DbSet<CheckpointLocation> CheckpointLocations { get; }
    DbSet<CheckpointTriggerLog> CheckpointTriggerLogs { get; }
    DbSet<ProcessLogRow> ProcessLogRows { get; }
    // Phase 3: Testing Execution + Digital Logbook
    DbSet<TestExecution> TestExecutions { get; }
    DbSet<DigitalLogbookEntry> DigitalLogbookEntries { get; }
    DbSet<OosInvestigation> OosInvestigations { get; }
    DbSet<ResultsReview> ResultsReviews { get; }
    DbSet<ResultEvidence> ResultEvidences { get; }
    // Phase 4: CoA Generation + QA Review + Dispatch QC
    DbSet<DeliveryOrder> DeliveryOrders { get; }
    DbSet<Coa> Coas { get; }
    DbSet<CoaLine> CoaLines { get; }
    DbSet<CoaDistributionLog> CoaDistributionLogs { get; }
    DbSet<CoaApproval> CoaApprovals { get; }
    DbSet<DispatchQcTask> DispatchQcTasks { get; }
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
