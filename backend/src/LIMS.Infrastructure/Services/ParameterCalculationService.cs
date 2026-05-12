using LIMS.Application.Interfaces;
using System.Data;

namespace LIMS.Infrastructure.Services;

// Contract 2: formula applied server-side — result read-only in UI (ALCOA+ Original)
public class ParameterCalculationService : IParameterCalculationService
{
    public decimal? Calculate(string rawValue, string? formula, string formulaType)
    {
        if (!decimal.TryParse(rawValue, System.Globalization.NumberStyles.Any,
            System.Globalization.CultureInfo.InvariantCulture, out var raw))
            return null;

        if (string.IsNullOrWhiteSpace(formula))
            return raw;

        try
        {
            // Replace {x} token with the raw numeric value
            var expression = formula.Replace("{x}", raw.ToString(System.Globalization.CultureInfo.InvariantCulture));
            var dt = new DataTable();
            var result = dt.Compute(expression, null);
            return Convert.ToDecimal(result);
        }
        catch
        {
            // Formula evaluation failed — return raw value
            return raw;
        }
    }
}
