using LIMS.Application.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Infrastructure.Services;

// Contract 2: correction table from DB (not hardcoded). Applied server-side before formula.
public class AutoCorrectionService : IAutoCorrectionService
{
    private readonly ILimsDbContext _db;
    public AutoCorrectionService(ILimsDbContext db) => _db = db;

    public async Task<CorrectionResult> ApplyAsync(int labId, string parameterName, decimal rawValue, CancellationToken ct = default)
    {
        // Correction table stored in LabConfig as JSON: key = "auto_correction_{paramName}"
        // Value example: {"type":"SG_TEMP_NORM","factor":0.9972,"offset":0}
        var configKey = $"auto_correction_{parameterName.ToLower().Replace(" ", "_")}";
        var config = await _db.LabConfigs
            .FirstOrDefaultAsync(c => c.LabId == labId && c.ConfigKey == configKey, ct);

        if (config is null || string.IsNullOrEmpty(config.ConfigValue))
            return new CorrectionResult(rawValue, false, null);

        try
        {
            var json = System.Text.Json.JsonDocument.Parse(config.ConfigValue).RootElement;
            var type = json.GetProperty("type").GetString() ?? "";
            var factor = json.TryGetProperty("factor", out var f) ? f.GetDecimal() : 1m;
            var offset = json.TryGetProperty("offset", out var o) ? o.GetDecimal() : 0m;
            var corrected = rawValue * factor + offset;
            var detail = $"{type}: raw={rawValue}, factor={factor}, offset={offset}, corrected={corrected}";
            return new CorrectionResult(corrected, true, detail);
        }
        catch
        {
            return new CorrectionResult(rawValue, false, null);
        }
    }
}
