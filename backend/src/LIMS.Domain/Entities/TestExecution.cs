using LIMS.Domain.Enums;

namespace LIMS.Domain.Entities;

public class TestExecution
{
    public int ExecutionId { get; set; }
    public int SampleId { get; set; }
    public Sample Sample { get; set; } = null!;
    public int InstrumentId { get; set; }
    public Instrument Instrument { get; set; } = null!;
    public int AnalystId { get; set; }
    public User Analyst { get; set; } = null!;
    public int? AssignedById { get; set; }
    public User? AssignedBy { get; set; }
    public int? FormTemplateId { get; set; }
    public FormTemplate? FormTemplate { get; set; }
    public TestExecutionStatus Status { get; set; } = TestExecutionStatus.Assigned;
    public EntryMethod EntryMethod { get; set; } = EntryMethod.Manual;
    public bool AutoCorrected { get; set; } = false;
    public string? CorrectionType { get; set; }
    public int? PriorityScore { get; set; }
    public DateTimeOffset? StartedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
    public string CreatedBy { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<DigitalLogbookEntry> LogbookEntries { get; set; } = [];
    public ICollection<OosInvestigation> OosInvestigations { get; set; } = [];
    public ICollection<ResultsReview> ResultsReviews { get; set; } = [];
}
