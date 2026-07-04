using LIMS.Domain.Enums;

namespace LIMS.Domain.Entities;

// Phase 4 — CoA Generation (21 CFR 211.194)
// Contract 1: CoAGenerationService is the single builder — no other path creates a CoA

public class DeliveryOrder
{
    public int DoId { get; set; }
    public string DoNumber { get; set; } = string.Empty;       // UNIQUE — ERP reference
    public string? CustomerName { get; set; }
    public DateOnly? DespatchDate { get; set; }
    public string? PackingType { get; set; }
    public int ProductId { get; set; }
    public Material Product { get; set; } = null!;
    public DispatchStatus Status { get; set; } = DispatchStatus.Pending;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<DispatchQcTask> DispatchQcTasks { get; set; } = [];
    public ICollection<Coa> Coas { get; set; } = [];
}

public class Coa
{
    public int CoaId { get; set; }
    public int SampleId { get; set; }
    public Sample Sample { get; set; } = null!;
    public string CoaNumber { get; set; } = string.Empty;      // UNIQUE — server-generated from lab_config format
    public int? FormTemplateId { get; set; }
    public FormTemplate? FormTemplate { get; set; }
    public int? DeliveryOrderId { get; set; }
    public DeliveryOrder? DeliveryOrder { get; set; }
    public CoaStatus Status { get; set; } = CoaStatus.Draft;
    public DateTimeOffset? LockedAt { get; set; }              // set atomically on QA e-sig
    public byte[]? PdfBlob { get; set; }                       // server-generated locked PDF (EU Annex 11 §11)
    public int? QaSignatureId { get; set; }
    public ElectronicSignature? QaSignature { get; set; }
    public int? SupersededById { get; set; }
    public Coa? SupersededBy { get; set; }                     // ALCOA+ Enduring — never delete original
    public bool IsConditionalRelease { get; set; } = false;    // conditional release bypasses soft gates (items 7, 8)
    public string? ConditionalJustification { get; set; }      // mandatory when IsConditionalRelease = true
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<CoaLine> Lines { get; set; } = [];
    public ICollection<CoaDistributionLog> DistributionLogs { get; set; } = [];
    public ICollection<CoaApproval> Approvals { get; set; } = [];
}

public class CoaLine
{
    public int CoaLineId { get; set; }
    public int CoaId { get; set; }
    public Coa Coa { get; set; } = null!;
    public int EntryId { get; set; }
    public DigitalLogbookEntry Entry { get; set; } = null!;    // FK only — no copy (Contract 1)
    public int ParameterId { get; set; }
    public TestMethodParameter Parameter { get; set; } = null!; // FK only — no copy
    public int DisplayOrder { get; set; }
}

// INSERT-only distribution log (Contract 1: CoADistributionService is single sender)
public class CoaDistributionLog
{
    public long LogId { get; set; }
    public int CoaId { get; set; }
    public Coa Coa { get; set; } = null!;
    public string Channel { get; set; } = string.Empty;        // ERP | Archive | Email
    public DateTimeOffset SentAt { get; set; } = DateTimeOffset.UtcNow;
    public string Status { get; set; } = string.Empty;         // Sent | Failed
}

// INSERT-only QA approval / rejection (EU Annex 11 §13 — DB trigger blocks UPDATE on Rejected rows)
public class CoaApproval
{
    public int ApprovalId { get; set; }
    public int SampleId { get; set; }
    public Sample Sample { get; set; } = null!;
    public int CoaId { get; set; }
    public Coa Coa { get; set; } = null!;
    public string Decision { get; set; } = string.Empty;       // Approved | Rejected
    public string? Justification { get; set; }                 // mandatory for Rejected
    public int SignatureId { get; set; }
    public ElectronicSignature Signature { get; set; } = null!;
    public DateTimeOffset DecidedAt { get; set; } = DateTimeOffset.UtcNow;
}

// Phase 4: Dispatch QC Task — created by DispatchEventService (Contract 1)
public class DispatchQcTask
{
    public int TaskId { get; set; }
    public int DoId { get; set; }
    public DeliveryOrder DeliveryOrder { get; set; } = null!;
    public int SampleId { get; set; }
    public Sample Sample { get; set; } = null!;
    public int? ExecutionId { get; set; }
    public TestExecution? Execution { get; set; }
    public int FormTemplateId { get; set; }
    public FormTemplate FormTemplate { get; set; } = null!;
    public DispatchTaskStatus Status { get; set; } = DispatchTaskStatus.Open;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
