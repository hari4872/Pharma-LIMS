using LIMS.Domain.Enums;

namespace LIMS.Domain.Entities;

public class Instrument
{
    public int InstrumentId { get; set; }
    public int LabId { get; set; }
    public Laboratory Lab { get; set; } = default!;
    public string InstrumentCode { get; set; } = default!;  // UNIQUE
    public string? InstrumentName { get; set; }
    public string InstrumentType { get; set; } = default!;
    public string? Manufacturer { get; set; }
    public string? Model { get; set; }
    public string? SerialNumber { get; set; }
    public string? Location { get; set; }
    public DateOnly CalibrationDue { get; set; }
    public DateOnly? LastCalibration { get; set; }
    public InstrumentStatus Status { get; set; } = InstrumentStatus.Available;
    public bool IsActive { get; set; } = true;
    public string CreatedBy { get; set; } = default!;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<CalibrationRecord> CalibrationRecords { get; set; } = [];
    public ICollection<InstrumentBreakdown> Breakdowns { get; set; } = [];
}
