using System.IO.Ports;
using LIMS.InstrumentGateway.Models;
using LIMS.InstrumentGateway.Parsers;

namespace LIMS.InstrumentGateway.Services;

/// <summary>
/// One background task per configured instrument port.
/// Reads lines, parses them, looks up the active execution in LIMS, and submits the result.
/// Auto-reconnects if the port is lost (instrument powered off / USB unplugged).
/// </summary>
public class SerialPortListenerService : BackgroundService
{
    private readonly InstrumentPortConfig _portConfig;
    private readonly IInstrumentParser _parser;
    private readonly LimsApiClient _lims;
    private readonly ILogger<SerialPortListenerService> _log;

    private const int ReconnectDelayMs = 5_000;

    public SerialPortListenerService(
        InstrumentPortConfig portConfig,
        IInstrumentParser parser,
        LimsApiClient lims,
        ILogger<SerialPortListenerService> log)
    {
        _portConfig = portConfig;
        _parser     = parser;
        _lims       = lims;
        _log        = log;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _log.LogInformation(
            "Starting listener for [{Name}] on {Port} @ {Baud} baud (parser: {Parser})",
            _portConfig.Name, _portConfig.PortName, _portConfig.BaudRate, _parser.ParserType);

        while (!stoppingToken.IsCancellationRequested)
        {
            SerialPort? port = null;
            try
            {
                port = BuildPort(_portConfig);
                port.Open();
                _log.LogInformation("[{Name}] Port {Port} opened.", _portConfig.Name, _portConfig.PortName);

                while (!stoppingToken.IsCancellationRequested && port.IsOpen)
                {
                    try
                    {
                        var line = await ReadLineAsync(port, stoppingToken);
                        if (string.IsNullOrWhiteSpace(line)) continue;

                        _log.LogDebug("[{Name}] RAW: {Line}", _portConfig.Name, line);

                        var reading = _parser.Parse(line, _portConfig);
                        if (!reading.IsValid)
                        {
                            if (reading.ParseError is not null)
                                _log.LogDebug("[{Name}] Parse skip: {Reason}", _portConfig.Name, reading.ParseError);
                            continue;
                        }

                        await HandleReadingAsync(reading, stoppingToken);
                    }
                    catch (TimeoutException) { /* port.ReadLine timeout — normal, just loop */ }
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _log.LogWarning("[{Name}] Port error: {Msg}. Reconnecting in {Delay}s...",
                    _portConfig.Name, ex.Message, ReconnectDelayMs / 1000);
            }
            finally
            {
                port?.Close();
                port?.Dispose();
            }

            if (!stoppingToken.IsCancellationRequested)
                await Task.Delay(ReconnectDelayMs, stoppingToken);
        }
    }

    private async Task HandleReadingAsync(InstrumentReading reading, CancellationToken ct)
    {
        // If ASTM gave us a barcode, use it; otherwise the analyst must have the execution open
        var executionId = reading.SampleBarcode is not null
            ? await _lims.FindActiveExecutionAsync(reading.SampleBarcode, ct)
            : null;

        if (executionId is null && _portConfig.AutoSubmit)
        {
            _log.LogWarning(
                "[{Name}] No active execution found for barcode={Barcode}. Result buffered — analyst must link manually.",
                _portConfig.Name, reading.SampleBarcode ?? "(none)");

            // Log the reading so it isn't lost — analyst can re-enter in the LIMS UI
            _log.LogInformation(
                "[{Name}] BUFFERED RESULT: {Param}={Value} {Unit} at {Time}",
                _portConfig.Name, reading.ParameterName, reading.NumericValue, reading.Unit, reading.Timestamp);
            return;
        }

        if (executionId is not null)
            await _lims.SubmitResultAsync(executionId.Value, reading, ct);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private static SerialPort BuildPort(InstrumentPortConfig cfg) => new()
    {
        PortName  = cfg.PortName,
        BaudRate  = cfg.BaudRate,
        DataBits  = cfg.DataBits,
        Parity    = Enum.Parse<Parity>(cfg.Parity, ignoreCase: true),
        StopBits  = Enum.Parse<StopBits>(cfg.StopBits, ignoreCase: true),
        Handshake = Enum.Parse<Handshake>(cfg.Handshake, ignoreCase: true),
        NewLine   = cfg.Terminator,
        ReadTimeout  = 2_000,
        WriteTimeout = 1_000,
    };

    // ReadLine blocks; run on thread-pool so CancellationToken can stop it cleanly
    private static Task<string> ReadLineAsync(SerialPort port, CancellationToken ct) =>
        Task.Run(() => port.ReadLine(), ct);
}
