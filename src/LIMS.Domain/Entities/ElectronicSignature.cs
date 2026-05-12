namespace LIMS.Domain.Entities;

// 21 CFR §11.50: full_name + signed_at UTC + meaning + reason — all four NOT NULL
// INSERT-only — no UPDATE/DELETE ever
public class ElectronicSignature
{
    public int SignatureId { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = default!;
    public string FullName { get; set; } = default!;        // §11.50 printed name
    public DateTimeOffset SignedAt { get; set; }            // §11.50 UTC — server-side only
    public string Meaning { get; set; } = default!;         // §11.50 meaning
    public string Reason { get; set; } = default!;          // §11.50 reason
    public string ActionType { get; set; } = default!;
}
