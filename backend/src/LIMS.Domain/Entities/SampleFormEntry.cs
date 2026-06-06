using System.ComponentModel.DataAnnotations.Schema;

namespace LIMS.Domain.Entities;

// INSERT-only record of a monitoring form submission against a sample (21 CFR §11.10(e))
[Table("sample_form_entries")]
public class SampleFormEntry
{
    public int SampleFormEntryId { get; set; }
    public int SampleId { get; set; }
    public Sample Sample { get; set; } = default!;
    public int FormTemplateId { get; set; }
    public FormTemplate FormTemplate { get; set; } = default!;
    public string FieldValuesJson { get; set; } = "{}";  // JSON dict of fieldId → value
    public string SubmittedBy { get; set; } = default!;
    public DateTimeOffset SubmittedAt { get; set; } = DateTimeOffset.UtcNow;
}
