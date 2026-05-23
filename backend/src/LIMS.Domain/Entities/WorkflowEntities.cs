namespace LIMS.Domain.Entities;

/// <summary>
/// Configurable workflow template — defines the steps required for a sample
/// to progress from Registered to Released for a given Material/SampleType.
/// </summary>
public class WorkflowTemplate
{
    public int WorkflowTemplateId { get; set; }
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    /// <summary>null = matches all materials</summary>
    public int? MaterialId { get; set; }
    public Material? Material { get; set; }
    /// <summary>null = matches all sample types</summary>
    public int? SampleTypeId { get; set; }
    public SampleType? SampleType { get; set; }
    /// <summary>Used as fallback when no specific material/type match exists</summary>
    public bool IsDefault { get; set; } = false;
    public bool IsActive { get; set; } = true;
    public string CreatedBy { get; set; } = default!;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public string? UpdatedBy { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }
    public ICollection<WorkflowStep> Steps { get; set; } = new List<WorkflowStep>();
}

/// <summary>
/// One step within a WorkflowTemplate. Steps are ordered by StepOrder.
/// </summary>
public class WorkflowStep
{
    public int WorkflowStepId { get; set; }
    public int WorkflowTemplateId { get; set; }
    public WorkflowTemplate Template { get; set; } = null!;
    public int StepOrder { get; set; }
    public string StepName { get; set; } = default!;
    /// <summary>Role that must perform this step: Analyst, QA, LabManager, Admin</summary>
    public string RequiredRole { get; set; } = "Analyst";
    public bool RequiresESignature { get; set; } = false;
    /// <summary>Minimum number of completed test executions before this step can be done</summary>
    public int? MinTestsRequired { get; set; }
    /// <summary>Gate condition code: AllTestsComplete | NoOpenOOS | CoAApproved | LogbookSigned</summary>
    public string? GateCondition { get; set; }
    public bool IsOptional { get; set; } = false;
    public string? Notes { get; set; }
}
