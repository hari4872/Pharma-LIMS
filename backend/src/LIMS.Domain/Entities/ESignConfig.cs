using LIMS.Domain.Enums;

namespace LIMS.Domain.Entities;

public class ESignConfig
{
    public string ActionKey { get; set; } = null!;
    public ESignMethod Method { get; set; }
    public bool FourEye { get; set; }
    public string UpdatedBy { get; set; } = null!;
    public DateTime UpdatedAt { get; set; }
}
