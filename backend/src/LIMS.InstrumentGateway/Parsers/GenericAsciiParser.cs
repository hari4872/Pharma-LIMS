using System.Text.RegularExpressions;
using LIMS.InstrumentGateway.Models;

namespace LIMS.InstrumentGateway.Parsers;

/// <summary>
/// Handles simple ASCII instruments (balances, pH meters, melting point) that print
/// one numeric value per line, e.g.:
///   "     12.3456 g"
///   "Result: 98.75 %"
///   "MP: 68.4 C"
/// </summary>
public partial class GenericAsciiParser : IInstrumentParser
{
    public string ParserType => "GenericAscii";

    // Matches: optional label, numeric value, optional unit
    [GeneratedRegex(@"(?:.*?:\s*)?(?<value>[-+]?\d+(?:\.\d+)?)\s*(?<unit>[a-zA-Z%°\/]+)?")]
    private static partial Regex ValuePattern();

    public InstrumentReading Parse(string rawLine, InstrumentPortConfig config)
    {
        var line = rawLine.Trim();
        var reading = new InstrumentReading
        {
            InstrumentName  = config.Name,
            ParameterName   = config.DefaultParameterName,
            RawValue        = line,
            Timestamp       = DateTime.UtcNow,
        };

        if (string.IsNullOrWhiteSpace(line))
        {
            reading.ParseError = "Empty line";
            return reading;
        }

        var match = ValuePattern().Match(line);
        if (!match.Success)
        {
            reading.ParseError = $"No numeric value found in: {line}";
            return reading;
        }

        if (decimal.TryParse(match.Groups["value"].Value,
            System.Globalization.NumberStyles.Any,
            System.Globalization.CultureInfo.InvariantCulture,
            out var numeric))
        {
            reading.NumericValue = numeric;
            reading.Unit         = match.Groups["unit"].Value;
            reading.IsValid      = true;
        }
        else
        {
            reading.ParseError = $"Could not parse numeric: {match.Groups["value"].Value}";
        }

        return reading;
    }
}
