using LIMS.Domain.Enums;

namespace LIMS.Domain.Entities;

// Contract 4: Two user types only — Admin and Regular User
// Roles are Regular User variants with explicit write grants
public class User
{
    public int UserId { get; set; }
    public string Username { get; set; } = default!;   // UNIQUE constraint at DB level (Contract 4)
    public string PasswordHash { get; set; } = default!;
    public string FullName { get; set; } = default!;
    public string Email { get; set; } = default!;
    public UserType UserType { get; set; }
    public UserRole Role { get; set; }
    public int? LabId { get; set; }
    public Laboratory? Lab { get; set; }
    public bool IsActive { get; set; } = true;
    public bool IsTenantAdmin { get; set; } = false;   // Contract 4: first-run tenant admin
    public string CreatedBy { get; set; } = default!;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<UserTrainingRecord> TrainingRecords { get; set; } = [];
    public ICollection<ElectronicSignature> Signatures { get; set; } = [];
}
