using LIMS.Domain.Enums;

namespace LIMS.Domain.Entities;

// Phase 1b: Checkpoints — all 4 trigger modes feed CheckpointTriggerService (Contract 1)
public class Checkpoint
{
    public int CheckpointId { get; set; }
    public string CheckpointCode { get; set; } = default!;   // UNIQUE
    public int LabId { get; set; }
    public Laboratory Lab { get; set; } = default!;
    public TriggerType TriggerMode { get; set; }             // TimeBased | OperatorScan | ProcessLog | DispatchEvent
    public string CheckpointType { get; set; } = "Single";  // Single | Grouped
    public string? TimeSlots { get; set; }                   // JSONB — from DB config (Contract 2)
    public int? ShiftIntervalHrs { get; set; }               // Mode 3 interval
    public int? FormTemplateId { get; set; }                 // FK — which form runs when this checkpoint fires
    public FormTemplate? FormTemplate { get; set; }          // required for TimeBased/OperatorScan/ProcessLog; set by DispatchEventService for DispatchEvent
    public bool IsActive { get; set; } = true;

    public ICollection<CheckpointLocation> Locations { get; set; } = [];
    public ICollection<CheckpointTriggerLog> TriggerLogs { get; set; } = [];
    public ICollection<ProcessLogRow> ProcessLogRows { get; set; } = [];
}

// Grouped checkpoint column — FK only, no spec values copied (Contract 1)
public class CheckpointLocation
{
    public int LocationId { get; set; }
    public int CheckpointId { get; set; }
    public Checkpoint Checkpoint { get; set; } = default!;
    public int ColumnOrder { get; set; }
    public string LocationName { get; set; } = default!;
    public int? SpecLimitId { get; set; }                    // FK only — no spec values copied (Contract 1)
    public SpecLimit? SpecLimit { get; set; }
}

// INSERT-only trigger log — all 4 modes (ALCOA+ Contemporaneous)
public class CheckpointTriggerLog
{
    public long TriggerId { get; set; }
    public int CheckpointId { get; set; }
    public Checkpoint Checkpoint { get; set; } = default!;
    public string TriggerMode { get; set; } = default!;      // stored as string for immutability
    public string? TriggeredBy { get; set; }
    public DateTimeOffset TriggeredAt { get; set; } = DateTimeOffset.UtcNow;
    public string? DeliveryOrder { get; set; }               // Mode 4 reference
    public bool IsOfflineSync { get; set; } = false;         // EU Annex 11 §4.3
}

// Mode 3 (Process Log) rows — pre-populated by ProcessLogSchedulerJob
public class ProcessLogRow
{
    public int RowId { get; set; }
    public int CheckpointId { get; set; }
    public Checkpoint Checkpoint { get; set; } = default!;
    public DateTimeOffset SlotTime { get; set; }             // UTC server-side (Contract 2)
    public string SlotLabel { get; set; } = default!;
    public string Status { get; set; } = "Open";             // Open | Signed | Locked
    public int? SignatureId { get; set; }
    public ElectronicSignature? Signature { get; set; }
}
