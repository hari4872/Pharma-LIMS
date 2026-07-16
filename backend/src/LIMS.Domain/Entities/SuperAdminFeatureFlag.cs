namespace LIMS.Domain.Entities;

public class SuperAdminFeatureFlag
{
    public string Key { get; set; } = default!;
    public bool IsEnabled { get; set; } = true;
    public string UpdatedBy { get; set; } = "system";
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
