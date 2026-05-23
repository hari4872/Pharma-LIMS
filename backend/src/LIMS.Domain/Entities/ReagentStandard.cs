namespace LIMS.Domain.Entities;

// Master Data FR-09: Reagents & Standards — lot-traceable, potency-tracked, method-linked
public class ReagentStandard
{
    public int ReagentId { get; set; }
    public string ReagentCode { get; set; } = default!;         // UNIQUE — e.g. RS-0042
    public string ReagentName { get; set; } = default!;
    public string ReagentType { get; set; } = "Reagent";        // Reagent | Standard | ReferenceStandard
    public string LotNumber { get; set; } = default!;
    public decimal? Potency { get; set; }                       // % purity / potency value
    public string? PotencyUom { get; set; }                     // % | mg/mL | IU etc.
    public string? Manufacturer { get; set; }
    public DateOnly? ExpiryDate { get; set; }
    public DateOnly? OpenedDate { get; set; }                   // in-use start for stability tracking
    public int? LinkedMethodId { get; set; }                    // FK → TestMethod (which method uses this)
    public TestMethod? LinkedMethod { get; set; }
    public string? StorageCondition { get; set; }               // 2–8°C | RT | Frozen etc.
    public bool IsActive { get; set; } = true;
    public string CreatedBy { get; set; } = default!;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
