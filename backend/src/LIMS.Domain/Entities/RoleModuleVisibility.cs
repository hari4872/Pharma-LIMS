namespace LIMS.Domain.Entities;

public class RoleModuleVisibility
{
    public int Id { get; set; }
    public string Role { get; set; } = default!;
    public string NavKey { get; set; } = default!;
    public bool IsEnabled { get; set; } = true;
    public bool IsLockedBySuperAdmin { get; set; } = false;
    public string UpdatedBy { get; set; } = "system";
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
