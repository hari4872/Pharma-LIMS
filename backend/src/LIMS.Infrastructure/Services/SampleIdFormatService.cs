using LIMS.Application.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Infrastructure.Services;

// Contract 2: Sample ID format read from lab_config — never hardcoded
// Tokens: {SITE} {LAB} {MAT} {SAMPLETYPE} {DATE} {YYYYMMDD} {LOT} {SEQ} {SEQ3} {SEQ4}
public class SampleIdFormatService : ISampleIdFormatService
{
    private readonly ILimsDbContext _db;
    public SampleIdFormatService(ILimsDbContext db) => _db = db;

    public async Task<string> GenerateAsync(int labId, int materialId, string sampleType, string lotNumber, CancellationToken ct = default)
    {
        var lab = await _db.Laboratories.FindAsync([labId], ct);
        var material = await _db.Materials.FindAsync([materialId], ct);

        var formatConfig = await _db.LabConfigs
            .FirstOrDefaultAsync(c => c.LabId == labId && c.ConfigKey == "sample_id_format", ct);
        var format = formatConfig?.ConfigValue ?? "{LAB}-{SAMPLETYPE}-{YYYYMMDD}-{SEQ4}";

        // Sequence: count existing samples today for this lab
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var seqCount = await _db.Samples.CountAsync(
            s => s.LabId == labId && DateOnly.FromDateTime(s.CreatedAt.DateTime) == today, ct) + 1;

        var now = DateTime.UtcNow;
        var result = format
            .Replace("{SITE}", lab?.LabName?.Split(' ')[0].ToUpper() ?? "SITE")
            .Replace("{LAB}", lab?.LabName?.Replace(" ", "").ToUpper()[..Math.Min(4, lab.LabName.Length)] ?? "LAB")
            .Replace("{MAT}", material?.MaterialName?.Replace(" ", "").ToUpper()[..Math.Min(6, material?.MaterialName?.Length ?? 3)] ?? "MAT")
            .Replace("{SAMPLETYPE}", sampleType.ToUpper()[..Math.Min(4, sampleType.Length)])
            .Replace("{DATE}", now.ToString("yyyyMMdd"))
            .Replace("{YYYYMMDD}", now.ToString("yyyyMMdd"))
            .Replace("{LOT}", lotNumber.Replace(" ", "").ToUpper()[..Math.Min(8, lotNumber.Length)])
            .Replace("{SEQ4}", seqCount.ToString("D4"))
            .Replace("{SEQ3}", seqCount.ToString("D3"))
            .Replace("{SEQ}", seqCount.ToString());

        return result;
    }
}
