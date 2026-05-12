namespace LIMS.Domain.Entities;

public class CalibrationRecord
{
    public int CalibrationId { get; set; }
    public int InstrumentId { get; set; }
    public Instrument Instrument { get; set; } = default!;
    public DateOnly CalibrationDate { get; set; }
    public DateOnly NextCalibrationDue { get; set; }
    public string CertificateRef { get; set; } = default!;
    public string PerformedBy { get; set; } = default!;
    public int? SignatureId { get; set; }
    public ElectronicSignature? Signature { get; set; }     // QA §11.50 approval
    public string CreatedBy { get; set; } = default!;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
