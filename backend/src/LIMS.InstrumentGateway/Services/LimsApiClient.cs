using System.Net.Http.Json;
using System.Text.Json;
using LIMS.InstrumentGateway.Models;

namespace LIMS.InstrumentGateway.Services;

public class LimsApiClient
{
    private readonly HttpClient _http;
    private readonly GatewayConfig _config;
    private readonly ILogger<LimsApiClient> _log;

    private string? _token;
    private DateTime _tokenExpiry = DateTime.MinValue;

    private static readonly JsonSerializerOptions _json = new(JsonSerializerDefaults.Web);

    public LimsApiClient(HttpClient http, GatewayConfig config, ILogger<LimsApiClient> log)
    {
        _http   = http;
        _config = config;
        _log    = log;
    }

    // ── Auth ─────────────────────────────────────────────────────────────────

    private async Task EnsureAuthenticatedAsync(CancellationToken ct)
    {
        if (_token is not null && DateTime.UtcNow < _tokenExpiry.AddMinutes(-2))
            return;

        var payload = new { username = _config.ServiceUsername, password = _config.ServicePassword };
        var resp = await _http.PostAsJsonAsync("/api/v1/auth/login", payload, ct);
        resp.EnsureSuccessStatusCode();

        var body = await resp.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: ct);
        _token = body.GetProperty("token").GetString()!;

        // JWT expiry: parse or default to 1 hour
        _tokenExpiry = body.TryGetProperty("expiresAt", out var exp)
            ? exp.GetDateTime()
            : DateTime.UtcNow.AddHours(1);

        _http.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _token);

        _log.LogInformation("Authenticated with LIMS API, token valid until {Expiry}", _tokenExpiry);
    }

    // ── Work Queue lookup ──────────────────────────────────────────────────

    /// <summary>
    /// Find the InProgress execution ID for a given sample number or container barcode.
    /// Returns null if no matching active execution found.
    /// </summary>
    public async Task<int?> FindActiveExecutionAsync(string sampleOrBarcode, CancellationToken ct)
    {
        await EnsureAuthenticatedAsync(ct);

        var resp = await _http.GetAsync($"/api/v1/test-executions?status=InProgress", ct);
        if (!resp.IsSuccessStatusCode) return null;

        var items = await resp.Content.ReadFromJsonAsync<List<WorkQueueItem>>(_json, ct) ?? [];

        var match = items.FirstOrDefault(i =>
            i.SampleNumber.Equals(sampleOrBarcode, StringComparison.OrdinalIgnoreCase) ||
            (i.ContainerLabel?.Equals(sampleOrBarcode, StringComparison.OrdinalIgnoreCase) ?? false));

        return match?.ExecutionId;
    }

    // ── Submit result ──────────────────────────────────────────────────────

    public async Task<bool> SubmitResultAsync(int executionId, InstrumentReading reading, CancellationToken ct)
    {
        await EnsureAuthenticatedAsync(ct);

        var payload = new LimsSubmitResultsRequest
        {
            EntryMethod = "Instrument",
            Entries =
            [
                new LimsResultEntry
                {
                    ParameterName = reading.ParameterName,
                    Value         = reading.NumericValue?.ToString("G", System.Globalization.CultureInfo.InvariantCulture)
                                    ?? reading.RawValue,
                    Unit          = reading.Unit,
                }
            ]
        };

        var resp = await _http.PostAsJsonAsync($"/api/v1/test-executions/{executionId}/results", payload, ct);
        if (resp.IsSuccessStatusCode)
        {
            _log.LogInformation(
                "Submitted result for ExecutionId={Id}: {Param}={Value} {Unit}",
                executionId, reading.ParameterName, reading.NumericValue, reading.Unit);
            return true;
        }

        var error = await resp.Content.ReadAsStringAsync(ct);
        _log.LogWarning("Submit failed for ExecutionId={Id}: {Status} — {Error}",
            executionId, resp.StatusCode, error);
        return false;
    }
}
