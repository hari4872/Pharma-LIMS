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

    // 21 CFR §11.10(d) — account lockout after consecutive failed logins
    public int FailedLoginCount { get; set; } = 0;
    public DateTimeOffset? LockedUntil { get; set; }
    public DateTimeOffset? LastLoginAt { get; set; }
    public string? LastLoginIp { get; set; }

    // Custom permission overrides — null means use role defaults
    public string? CustomPermissionsJson { get; set; }

    public ICollection<UserTrainingRecord> TrainingRecords { get; set; } = [];
    public ICollection<ElectronicSignature> Signatures { get; set; } = [];
}
