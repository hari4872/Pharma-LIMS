using LIMS.Domain.Enums;

namespace LIMS.Domain.Entities;

public class EmSample
{
    public int EmSampleId { get; set; }
    public string SampleNumber { get; set; } = default!;       // e.g. WFI-POU01-20261019-001

    public int CheckpointId { get; set; }
    public Checkpoint Checkpoint { get; set; } = default!;

    public string SlotLabel { get; set; } = default!;          // e.g. "08:00"
    public DateOnly SamplingDate { get; set; }
    public EmSampleStatus Status { get; set; } = EmSampleStatus.Scheduled;

    // Collection step
    public DateTimeOffset? CollectedAt { get; set; }
    public string? CollectedBy { get; set; }

    // Lab receipt step
    public DateTimeOffset? ReceivedAt { get; set; }
    public string? ReceivedBy { get; set; }

    // Analysis step
    public DateTimeOffset? AnalysisStartedAt { get; set; }
    public string? AssignedAnalyst { get; set; }

    // Link to the executed process log row (once analyst records readings)
    public int? ProcessLogRowId { get; set; }
    public ProcessLogRow? ProcessLogRow { get; set; }

    // Results approval step
    public DateTimeOffset? ResultsApprovedAt { get; set; }
    public string? ResultsApprovedBy { get; set; }
    public string? ResultStatus { get; set; }               // Pass | AlertExceeded | ActionExceeded

    // Investigation (auto-created on ActionExceeded)
    public string? InvestigationNumber { get; set; }
    public string? InvestigationStatus { get; set; }        // Open | Closed
    public string? InvestigationNotes { get; set; }

    public DateTimeOffset ExpiresAt { get; set; }           // SamplingDate + 3 days default
    public string CreatedBy { get; set; } = default!;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
