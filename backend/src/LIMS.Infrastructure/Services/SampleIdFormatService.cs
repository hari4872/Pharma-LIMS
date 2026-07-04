using LIMS.Application.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Infrastructure.Services;

// Contract 2: Sample ID format read from lab_config — never hardcoded
// Tokens: {SITE} {LAB} {MAT} {SAMPLETYPE} {DATE} {YYYYMMDD} {LOT} {SEQ} {SEQ3} {SEQ4}
public class SampleIdFormatService : ISampleIdFormatService
{
    private readonly ILimsDbContext _db;
    public SampleIdFormatService(ILimsDbContext db) => _db = db;

    public async Task<string> GenerateAsync(int labId, int materialId, string sampleType, string lotNumber, int sequenceOffset = 0, CancellationToken ct = default)
    {
        var lab = await _db.Laboratories.FindAsync([labId], ct);
        var material = await _db.Materials.FindAsync([materialId], ct);

        var formatConfig = await _db.LabConfigs
            .FirstOrDefaultAsync(c => c.LabId == labId && c.ConfigKey == "sample_id_format", ct);
        var format = formatConfig?.ConfigValue ?? "{LAB}-{SAMPLETYPE}-{YYYYMMDD}-{SEQ4}";

        // Sequence: count existing samples today for this lab (date-range avoids untranslatable DateOnly.FromDateTime in LINQ)
        var dayStart = new DateTimeOffset(DateOnly.FromDateTime(DateTime.UtcNow).ToDateTime(TimeOnly.MinValue), TimeSpan.Zero);
        var dayEnd   = dayStart.AddDays(1);
        var seqCount = await _db.Samples.CountAsync(
            s => s.LabId == labId && s.CreatedAt >= dayStart && s.CreatedAt < dayEnd, ct) + 1 + sequenceOffset;

        var now = DateTime.UtcNow;
        var labName = lab?.LabName ?? string.Empty;
        var matName = material?.MaterialName ?? string.Empty;
        var labStripped = labName.Replace(" ", "").ToUpper();
        var matStripped = matName.Replace(" ", "").ToUpper();
        var lotStripped = (lotNumber ?? string.Empty).Replace(" ", "").ToUpper();
        var stStripped  = (sampleType ?? string.Empty).Replace(" ", "").ToUpper();
        var result = format
            .Replace("{SITE}", labName.Length > 0 ? labName.Split(' ')[0].ToUpper() : "SITE")
            .Replace("{LAB}", labStripped.Length > 0 ? labStripped[..Math.Min(4, labStripped.Length)] : "LAB")
            .Replace("{MAT}", matStripped.Length > 0 ? matStripped[..Math.Min(6, matStripped.Length)] : "MAT")
            .Replace("{SAMPLETYPE}", stStripped.Length > 0 ? stStripped[..Math.Min(4, stStripped.Length)] : "TYPE")
            .Replace("{DATE}", now.ToString("yyyyMMdd"))
            .Replace("{YYYYMMDD}", now.ToString("yyyyMMdd"))
            .Replace("{LOT}", lotStripped.Length > 0 ? lotStripped[..Math.Min(8, lotStripped.Length)] : "LOT")
            .Replace("{SEQ4}", seqCount.ToString("D4"))
            .Replace("{SEQ3}", seqCount.ToString("D3"))
            .Replace("{SEQ}", seqCount.ToString());

        return result;
    }
}
