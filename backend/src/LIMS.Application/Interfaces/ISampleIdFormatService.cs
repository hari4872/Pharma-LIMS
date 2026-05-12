namespace LIMS.Application.Interfaces;

// Contract 2: Sample ID generated server-side from configurable format in lab_config — never typed by analyst
// Tokens: {SITE} {LAB} {MAT} {SAMPLETYPE} {DATE} {YYYYMMDD} {LOT} {SEQ} {SEQ3} {SEQ4}
public interface ISampleIdFormatService
{
    Task<string> GenerateAsync(int labId, int materialId, string sampleType, string lotNumber, CancellationToken ct = default);
}
