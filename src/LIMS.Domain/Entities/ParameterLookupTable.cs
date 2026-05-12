namespace LIMS.Domain.Entities;

// Contract 1: lookup table loaded ONCE — all parameters reference via FK
public class ParameterLookupTable
{
    public int LookupTableId { get; set; }
    public string LookupCode { get; set; } = default!;     // e.g. SG_TEMP_CONC — UNIQUE
    public string InputCol1 { get; set; } = default!;
    public string? InputCol2 { get; set; }
    public string ResultCol { get; set; } = default!;
    public bool IsActive { get; set; } = true;

    public ICollection<ParameterLookupRow> Rows { get; set; } = [];
}

public class ParameterLookupRow
{
    public int RowId { get; set; }
    public int LookupTableId { get; set; }
    public ParameterLookupTable LookupTable { get; set; } = default!;
    public decimal InputValue1 { get; set; }
    public decimal? InputValue2 { get; set; }
    public decimal ResultValue { get; set; }
}
