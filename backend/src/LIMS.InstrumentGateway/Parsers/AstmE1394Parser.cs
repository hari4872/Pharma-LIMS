using System.Text.RegularExpressions;
using LIMS.InstrumentGateway.Models;

namespace LIMS.InstrumentGateway.Parsers;

/// <summary>
/// ASTM E1394 parser for clinical/analytical instruments (auto-titrators, ICP-MS,
/// Karl Fischer, GC). Frame format:
///   H|\^&amp;|||Instrument|||||LIS||P|1|YYYYMMDDHHMMSS
///   P|1||SampleBarcode
///   O|1|SampleBarcode||^^^TestName|||...
///   R|1|^^^TestName|Value|Unit|RefRange|...
///   L|1|N
/// </summary>
public partial class AstmE1394Parser : IInstrumentParser
{
    public string ParserType => "AstmE1394";

    // R record: R|seq|^^^TestName|Value|Unit|...
    [GeneratedRegex(@"^R\|(\d+)\|\^\^\^([^|]+)\|([^|]*)\|([^|]*)")]
    private static partial Regex RRecord();

    // P record: P|seq||SampleID
    [GeneratedRegex(@"^P\|\d+\|\|([^|]+)")]
    private static partial Regex PRecord();

    private string? _currentBarcode;

    public InstrumentReading Parse(string rawLine, InstrumentPortConfig config)
    {
        var line = rawLine.Trim().TrimStart('\x02').TrimEnd('\x03'); // strip STX/ETX
        var reading = new InstrumentReading
        {
            InstrumentName = config.Name,
            RawValue       = rawLine,
            Timestamp      = DateTime.UtcNow,
        };

        // P record — captures sample barcode for subsequent R records
        var pMatch = PRecord().Match(line);
        if (pMatch.Success)
        {
            _currentBarcode = pMatch.Groups[1].Value.Trim();
            reading.ParseError = "P-record (barcode captured, waiting for R)";
            return reading;
        }

        // R record — actual result
        var rMatch = RRecord().Match(line);
        if (!rMatch.Success)
        {
            reading.ParseError = $"Not an R-record: {line}";
            return reading;
        }

        var testName = rMatch.Groups[2].Value.Trim();
        var rawValue = rMatch.Groups[3].Value.Trim();
        var unit     = rMatch.Groups[4].Value.Trim();

        reading.ParameterName  = string.IsNullOrEmpty(config.DefaultParameterName) ? testName : config.DefaultParameterName;
        reading.Unit           = unit;
        reading.SampleBarcode  = _currentBarcode;
        reading.RawValue       = rawValue;

        if (decimal.TryParse(rawValue,
            System.Globalization.NumberStyles.Any,
            System.Globalization.CultureInfo.InvariantCulture,
            out var numeric))
        {
            reading.NumericValue = numeric;
            reading.IsValid      = true;
        }
        else
        {
            reading.ParseError = $"Non-numeric R value: {rawValue}";
        }

        return reading;
    }
}
