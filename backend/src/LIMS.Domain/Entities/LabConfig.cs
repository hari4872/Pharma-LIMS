namespace LIMS.Domain.Entities;

// Contract 2: all config values from PostgreSQL — no hardcoded values anywhere
public class LabConfig
{
    public int ConfigId { get; set; }
    public int LabId { get; set; }
    public Laboratory Lab { get; set; } = default!;
    public string ConfigKey { get; set; } = default!;
    // e.g. 'sample_id_format', 'tat_target_hrs', 'coa_number_format'
    public string ConfigValue { get; set; } = default!;
    public string UpdatedBy { get; set; } = default!;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
