namespace LIMS.Domain.Enums;

public enum LabType { QC, RD, Stability, Microbiology }

public enum InstrumentStatus { Available, InUse, Maintenance, OutOfCalibration }

public enum UserType { Admin, RegularUser }

public enum UserRole { Admin, QA, QCLead, Analyst, LabManager, Viewer }

public enum ApprovalStatus { Draft, Approved, Retired }

public enum FormTemplateStatus { Draft, Active, Retired }

public enum TriggerType { TimeBased, OperatorScan, ProcessLog, DispatchEvent }

public enum FormType { Single, Grouped }

public enum DataType { Numeric, Text, PassFail }

public enum FormulaType { Expression, TableLookup }

public enum ColumnFrequency { Daily, Weekly, Periodic }

public enum MaterialType { RawMaterial, IntermediateProduct, FinishedProduct, Reagent, Standard }

public enum SpecStage { Incoming, InProcess, Finished, Stability }

public enum RegulatoryTier { USP, EP, ISO, MS, Internal }

public enum SampleStatus
{
    Registered, PendingTesting, InTesting, PendingQAReview, Released, Rejected
}

public enum TestExecutionStatus { Assigned, InProgress, Completed, OOSOpen }

public enum LogbookEntryStatus { Pending, Signed, Superseded }

public enum OosFlag { OOS, OOT }

public enum OosPhase { Phase1, Phase2 }

public enum OosStatus { Open, Closed }

public enum CoaStatus { Draft, Released, Superseded }

public enum DispatchStatus { Pending, InDispatchQC, Cleared, Blocked }

public enum DispatchTaskStatus { Open, InProgress, Passed, Failed, QAApproved }

public enum ReviewType { PeerReview, QCLeadVerification }

public enum EntryMethod { Manual, FileImport }

public enum LocationType { Ambient, Cold, Freezer, StabilityChamber }

public enum ExcursionType { Temperature, Humidity, Light }

public enum CdType { Complaint, Deviation, Capa }

public enum BreakdownStatus { Open, InRepair, Resolved }

public enum SampleMatrix { Solid, Liquid, Gas, Swab, Powder, Granule, Suspension, Emulsion }

// Phase A — Specification Engine
public enum SampleCondition    { OK, Damaged, Compromised }
public enum SpecAssignmentReason { AutoMatch, ManualOverride, NoTemplateFound }
public enum SpecTemplateStatus { Draft, Approved, Obsolete }

// Phase B — Sampling Plans & Stability
public enum FrequencyType { Hourly, Shift, Daily, Weekly, Monthly, Batch, Event, Stability, Environmental }
public enum StabilityStorageCondition { Accelerated, LongTerm, Intermediate, Refrigerated }
