using System.IO.Ports;
using LIMS.InstrumentGateway.Models;
using LIMS.InstrumentGateway.Parsers;
using LIMS.InstrumentGateway.Services;

// Show available COM ports before starting — helps operator verify connections
var availablePorts = SerialPort.GetPortNames();
Console.WriteLine($"[Gateway] Available COM ports: {(availablePorts.Length > 0 ? string.Join(", ", availablePorts) : "(none detected)")}");

var builder = Host.CreateApplicationBuilder(args);

// Run as a Windows Service (no-op on Linux / interactive console)
builder.Services.AddWindowsService(options =>
    options.ServiceName = "LIMS Instrument Gateway");

// ── Configuration ─────────────────────────────────────────────────────────
var config = builder.Configuration
    .GetSection("Gateway")
    .Get<GatewayConfig>() ?? new GatewayConfig();

builder.Services.AddSingleton(config);

// ── LIMS HTTP client ──────────────────────────────────────────────────────
builder.Services.AddHttpClient<LimsApiClient>(client =>
{
    client.BaseAddress = new Uri(config.LimsApiBaseUrl);
    client.Timeout     = TimeSpan.FromSeconds(30);
});

// ── Parser registry ───────────────────────────────────────────────────────
var parsers = new Dictionary<string, IInstrumentParser>(StringComparer.OrdinalIgnoreCase)
{
    ["GenericAscii"] = new GenericAsciiParser(),
    ["AstmE1394"]    = new AstmE1394Parser(),
    ["Sartorius"]    = new GenericAsciiParser(),   // Sartorius balances use ASCII
    ["Mettler"]      = new GenericAsciiParser(),   // Mettler-Toledo balances use ASCII
};

// ── One hosted service per configured instrument port ─────────────────────
foreach (var instrument in config.Instruments)
{
    if (!parsers.TryGetValue(instrument.InstrumentType, out var parser))
    {
        Console.Error.WriteLine(
            $"[WARN] Unknown InstrumentType '{instrument.InstrumentType}' for '{instrument.Name}'. Defaulting to GenericAscii.");
        parser = parsers["GenericAscii"];
    }

    var capturedInstrument = instrument;
    var capturedParser     = parser;

    builder.Services.AddSingleton<IHostedService>(sp =>
        new SerialPortListenerService(
            capturedInstrument,
            capturedParser,
            sp.GetRequiredService<LimsApiClient>(),
            sp.GetRequiredService<ILogger<SerialPortListenerService>>()
        ));
}

var host = builder.Build();
host.Run();
