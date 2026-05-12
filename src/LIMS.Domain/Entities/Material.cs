using LIMS.Domain.Enums;

namespace LIMS.Domain.Entities;

public class Material
{
    public int MaterialId { get; set; }
    public string MaterialName { get; set; } = default!;
    public MaterialType MaterialType { get; set; }
    public string Uom { get; set; } = default!;
    public int ShelfLifeDays { get; set; }
    public string? ProductType { get; set; }
    public bool IsActive { get; set; } = true;
    public string CreatedBy { get; set; } = default!;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<SpecLimit> SpecLimits { get; set; } = [];
}
