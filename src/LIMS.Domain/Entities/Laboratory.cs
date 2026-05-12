using LIMS.Domain.Enums;

namespace LIMS.Domain.Entities;

public class Laboratory
{
    public int LabId { get; set; }
    public string LabName { get; set; } = default!;
    public string Location { get; set; } = default!;
    public LabType LabType { get; set; }
    public bool IsActive { get; set; } = true;
    public string CreatedBy { get; set; } = default!;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<Instrument> Instruments { get; set; } = [];
    public ICollection<LabConfig> LabConfigs { get; set; } = [];
    public ICollection<FormTemplate> FormTemplates { get; set; } = [];
}
