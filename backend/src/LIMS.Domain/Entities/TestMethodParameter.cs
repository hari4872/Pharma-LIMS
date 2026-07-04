using LIMS.Domain.Enums;

namespace LIMS.Domain.Entities;

// Contract 1: parameter defined ONCE — all consumers reference parameter_id FK only
public class TestMethodParameter
{
    public int ParameterId { get; set; }
    public int MethodId { get; set; }
    public TestMethod Method { get; set; } = default!;
    public string ParameterName { get; set; } = default!;
    public string ParameterCode { get; set; } = default!;
    public string Uom { get; set; } = default!;
    public DataType DataType { get; set; }
    public FormulaType FormulaType { get; set; } = FormulaType.Expression;
    public string? CalcFormula { get; set; }                // server-side only (Contract 2)
    public string? InputFields { get; set; }                // JSON: [{key,label}] for multi-input formulas
    public int? DecimalPlaces { get; set; }               // null = no rounding; e.g. 2 = round to 2dp
    public int? LookupTableId { get; set; }
    public ParameterLookupTable? LookupTable { get; set; }
    public string? InstrumentType { get; set; }
    public bool IsCritical { get; set; } = false;
    public bool IsMandatory { get; set; } = true;
    public ColumnFrequency? ColumnFrequency { get; set; }
    public string CreatedBy { get; set; } = default!;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<SpecLimit> SpecLimits { get; set; } = [];
}
