using LIMS.InstrumentGateway.Models;

namespace LIMS.InstrumentGateway.Parsers;

public interface IInstrumentParser
{
    string ParserType { get; }
    InstrumentReading Parse(string rawLine, InstrumentPortConfig config);
}
