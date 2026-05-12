using LIMS.Domain.Enums;

namespace LIMS.Domain.Entities;

// Phase 1 Master Data — sample type defines what kind of sample can be registered
public class SampleType
{
    public int SampleTypeId { get; set; }
    public string TypeName { get; set; } = default!;        // e.g. Tablet, API, Water, Swab
    public string TypeCode { get; set; } = default!;        // UNIQUE — e.g. TAB, API, WTR
    public SampleMatrix Matrix { get; set; }
    public SpecStage Stage { get; set; }                    // Incoming / InProcess / Finished / Stability
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public string CreatedBy { get; set; } = default!;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
