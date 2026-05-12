using LIMS.Domain.Enums;

namespace LIMS.Domain.Entities;

public class InstrumentBreakdown
{
    public int BreakdownId { get; set; }
    public int InstrumentId { get; set; }
    public Instrument Instrument { get; set; } = default!;
    public int RaisedBy { get; set; }
    public User RaisedByUser { get; set; } = default!;
    public DateTimeOffset RaisedAt { get; set; } = DateTimeOffset.UtcNow;
    public string IssueDescription { get; set; } = default!;
    public BreakdownStatus Status { get; set; } = BreakdownStatus.Open;
    public int? ReturnSignatureId { get; set; }            // QA §11.50 return-to-service
    public ElectronicSignature? ReturnSignature { get; set; }

    public ICollection<InstrumentRepair> Repairs { get; set; } = [];
}

public class InstrumentRepair
{
    public int RepairId { get; set; }
    public int BreakdownId { get; set; }
    public InstrumentBreakdown Breakdown { get; set; } = default!;
    public string Technician { get; set; } = default!;
    public DateOnly RepairDate { get; set; }
    public string RepairDescription { get; set; } = default!;
    public string? PartsUsed { get; set; }
    public string RecordedBy { get; set; } = default!;
    public DateTimeOffset RecordedAt { get; set; } = DateTimeOffset.UtcNow;
}
