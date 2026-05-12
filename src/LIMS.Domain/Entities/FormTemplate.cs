using LIMS.Domain.Enums;

namespace LIMS.Domain.Entities;

// Contract 1: Form Template defined ONCE — all modules reference form_template_id FK only
public class FormTemplate
{
    public int FormTemplateId { get; set; }
    public string FormCode { get; set; } = default!;       // e.g. LAB-F-10 — UNIQUE
    public string FormName { get; set; } = default!;
    public int LabId { get; set; }
    public Laboratory Lab { get; set; } = default!;
    public FormType FormType { get; set; } = FormType.Single;
    public TriggerType TriggerType { get; set; }
    public string? TimeSlots { get; set; }                 // JSONB from DB config (Contract 2)
    public int? ShiftIntervalHrs { get; set; }
    public string? RegulatoryTier { get; set; }
    public bool EvidenceMandatory { get; set; } = false;
    public FormTemplateStatus Status { get; set; } = FormTemplateStatus.Draft;
    public string Version { get; set; } = "1.0";
    public string? ApprovedBy { get; set; }
    public DateTimeOffset? ApprovedAt { get; set; }
    public int? SignatureId { get; set; }
    public ElectronicSignature? Signature { get; set; }
    public bool IsActive { get; set; } = true;
    public string CreatedBy { get; set; } = default!;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<FormTemplateLocation> Locations { get; set; } = [];
    public ICollection<FormTemplateParameter> TemplateParameters { get; set; } = [];
}

public class FormTemplateLocation
{
    public int LocationId { get; set; }
    public int FormTemplateId { get; set; }
    public FormTemplate FormTemplate { get; set; } = default!;
    public int ColumnOrder { get; set; }
    public string LocationName { get; set; } = default!;
    public int? SpecLimitId { get; set; }                  // FK only — no spec values copied (Contract 1)
    public SpecLimit? SpecLimit { get; set; }
}

public class FormTemplateParameter
{
    public int FormTemplateId { get; set; }
    public FormTemplate FormTemplate { get; set; } = default!;
    public int ParameterId { get; set; }                   // FK only — no param definition copied (Contract 1)
    public TestMethodParameter Parameter { get; set; } = default!;
    public int DisplayOrder { get; set; }
    public ColumnFrequency? ColumnFrequency { get; set; }
}
