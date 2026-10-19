namespace LIMS.Domain.Entities;

public class EmSystem
{
    public int EmSystemId { get; set; }
    public string SystemName { get; set; } = default!;       // "WFI System"
    public string SystemCode { get; set; } = default!;       // "WFI"
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public string CreatedBy { get; set; } = "admin";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<EmSystemParameter> DefaultParameters { get; set; } = [];
}

public class EmSystemParameter
{
    public int EmSystemParameterId { get; set; }
    public int EmSystemId { get; set; }
    public EmSystem EmSystem { get; set; } = default!;

    public int ParameterId { get; set; }
    public TestMethodParameter Parameter { get; set; } = default!;

    public decimal? AlertMin  { get; set; }
    public decimal? AlertMax  { get; set; }
    public decimal? ActionMin { get; set; }
    public decimal? ActionMax { get; set; }
}
