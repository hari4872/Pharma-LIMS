using System.Data;
using System.Text.RegularExpressions;
using LIMS.Application.Interfaces;
using Microsoft.Extensions.Logging;

namespace LIMS.Infrastructure.Services;

public class CalcFormulaService : ICalcFormulaService
{
    private readonly ILogger<CalcFormulaService> _logger;
    public CalcFormulaService(ILogger<CalcFormulaService> logger) { _logger = logger; }

    public decimal? Evaluate(string formula, Dictionary<string, decimal> variables)
    {
        if (string.IsNullOrWhiteSpace(formula)) return null;
        try
        {
            // Replace {VarName} tokens with numeric values
            var expr = Regex.Replace(formula, @"\{(\w+)\}", m =>
            {
                var key = m.Groups[1].Value;
                return variables.TryGetValue(key, out var val) ? val.ToString("G") : "0";
            });

            // Also replace bare variable names (e.g. "A * B / 100")
            foreach (var kv in variables)
                expr = Regex.Replace(expr, $@"\b{Regex.Escape(kv.Key)}\b", kv.Value.ToString("G"));

            var dt = new DataTable();
            var result = dt.Compute(expr, null);
            return Convert.ToDecimal(result);
        }
        catch (Exception ex)
        {
            _logger.LogWarning("CalcFormula evaluation failed for '{Formula}': {Message}", formula, ex.Message);
            return null;
        }
    }

    public decimal ApplyRounding(decimal value, int? decimalPlaces)
    {
        if (decimalPlaces is null) return value;
        return Math.Round(value, decimalPlaces.Value, MidpointRounding.AwayFromZero);
    }
}
