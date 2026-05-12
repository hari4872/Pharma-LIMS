namespace LIMS.Domain.Entities;

public class ResultEvidence
{
    public int EvidenceId { get; set; }
    public int EntryId { get; set; }
    public DigitalLogbookEntry Entry { get; set; } = null!;
    public int SampleId { get; set; }
    public Sample Sample { get; set; } = null!;
    public string FileRef { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int UploadedById { get; set; }
    public User UploadedBy { get; set; } = null!;
    public DateTimeOffset UploadedAt { get; set; } = DateTimeOffset.UtcNow;
}
