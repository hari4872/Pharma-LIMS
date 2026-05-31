namespace LIMS.Application.Interfaces;

public interface ICalcFormulaService
{
    /// <summary>Evaluate a formula string with named variables. Returns null on error.</summary>
    decimal? Evaluate(string formula, Dictionary<string, decimal> variables);

    /// <summary>Round to decimalPlaces using AwayFromZero. Returns value unchanged when decimalPlaces is null.</summary>
    decimal ApplyRounding(decimal value, int? decimalPlaces);
}
