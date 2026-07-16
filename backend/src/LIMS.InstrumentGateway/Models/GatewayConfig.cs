namespace LIMS.InstrumentGateway.Models;

public class GatewayConfig
{
    public string LimsApiBaseUrl { get; set; } = "http://localhost:5204";
    public string ServiceUsername { get; set; } = "instrument.gateway";
    public string ServicePassword { get; set; } = "";
    public List<InstrumentPortConfig> Instruments { get; set; } = [];
}

public class InstrumentPortConfig
{
    public string Name { get; set; } = "";           // e.g. "Balance-A", "Titrator-1"
    public string InstrumentType { get; set; } = ""; // GenericAscii | AstmE1394 | Sartorius | Mettler
    public string PortName { get; set; } = "COM1";
    public int BaudRate { get; set; } = 9600;
    public int DataBits { get; set; } = 8;
    public string Parity { get; set; } = "None";     // None | Odd | Even | Mark | Space
    public string StopBits { get; set; } = "One";    // One | OnePointFive | Two
    public string Handshake { get; set; } = "None";  // None | XOnXOff | RequestToSend
    public string Terminator { get; set; } = "\r\n";
    public string DefaultParameterName { get; set; } = ""; // map to LIMS test parameter
    public bool AutoSubmit { get; set; } = true;     // post automatically vs. buffer for analyst confirm
}
