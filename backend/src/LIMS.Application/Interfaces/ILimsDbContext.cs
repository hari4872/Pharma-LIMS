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
    DbSet<ReagentStandard> ReagentStandards { get; }
    // Phase 2: Sample Registration
    DbSet<Sample> Samples { get; }
    DbSet<BarcodePrintLog> BarcodePrintLogs { get; }
    // Phase 1b: Checkpoints
    DbSet<Checkpoint> Checkpoints { get; }
    DbSet<CheckpointLocation> CheckpointLocations { get; }
    DbSet<CheckpointTriggerLog> CheckpointTriggerLogs { get; }
    DbSet<ProcessLogRow> ProcessLogRows { get; }
    DbSet<CheckpointParameter> CheckpointParameters { get; }
    // Phase 2: Sample Registration — join tables
    DbSet<SampleCheckpoint> SampleCheckpoints { get; }
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
    // Phase 5: Traceability
    DbSet<SamplingEvent> SamplingEvents { get; }
    DbSet<ComplaintsDeviation> ComplaintsDeviations { get; }
    DbSet<TraceQueryLog> TraceQueryLogs { get; }
    // Phase 5: Sample Inventory & Pull Planning
    DbSet<StorageLocation> StorageLocations { get; }
    DbSet<StorageTransferLog> StorageTransferLogs { get; }
    DbSet<ConditionExcursion> ConditionExcursions { get; }
    DbSet<ExcursionAffectedSample> ExcursionAffectedSamples { get; }
    DbSet<StabilityPull> StabilityPulls { get; }
    DbSet<ShortPullDeviation> ShortPullDeviations { get; }
    DbSet<RetainSample> RetainSamples { get; }
    // Phase 6: Instrument Management v1.2
    DbSet<InstrumentUtilisationSummary> InstrumentUtilisationSummaries { get; }
    // Phase 7: Dashboards
    DbSet<TatBreachLog> TatBreachLogs { get; }
    // Phase 8: Compliance & Governance
    DbSet<ValidationReviewLog> ValidationReviewLogs { get; }
    // Phase A: Specification Engine
    DbSet<SpecificationTemplate> SpecificationTemplates { get; }
    DbSet<SpecTemplateItem> SpecTemplateItems { get; }
    // Phase B: Sampling Plans & Stability Protocols
    DbSet<SamplingPlan> SamplingPlans { get; }
    DbSet<StabilityProtocol> StabilityProtocols { get; }
    DbSet<StabilityInterval> StabilityIntervals { get; }
    // Phase D: Instrument-Test Mapping
    DbSet<InstrumentTestMapping> InstrumentTestMappings { get; }
    // Sprint 7: Batch Release
    DbSet<BatchRelease> BatchReleases { get; }
    DbSet<BatchReleaseCheckItem> BatchReleaseCheckItems { get; }
    // Sprint 10: Workflow Engine
    DbSet<WorkflowTemplate> WorkflowTemplates { get; }
    DbSet<WorkflowStep> WorkflowSteps { get; }
    // MS-2: Inter-site Sample Transfer
    DbSet<SampleTransfer> SampleTransfers { get; }
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
