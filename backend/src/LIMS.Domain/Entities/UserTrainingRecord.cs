namespace LIMS.Domain.Entities;

// 21 CFR §11.10(i): expired training = hard block — no override
public class UserTrainingRecord
{
    public int TrainingId { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = default!;
    public int MethodId { get; set; }
    public TestMethod Method { get; set; } = default!;
    public DateOnly TrainingDate { get; set; }
    public DateOnly ValidUntil { get; set; }
    public bool IsExpired => DateOnly.FromDateTime(DateTime.UtcNow) > ValidUntil;
    public string RecordedBy { get; set; } = default!;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
