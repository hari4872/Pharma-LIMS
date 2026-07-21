using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.TestExecutions;

public record ImportInstrumentResultsCommand(
    int ExecutionId,
    int AnalystId,
    string FileName,
    byte[] CsvBytes) : IRequest<Result<ImportResultSummary>>;

public record ImportResultSummary(
    int TotalRows,
    int MatchedRows,
    int SkippedRows,
    List<ImportResultRow> Rows);

public record ImportResultRow(
    string ParameterName,
    string? RawValue,
    bool Matched,
    string PassFail,
    bool IsOos,
    bool IsOot,
    string? SkipReason);

public class ImportInstrumentResultsCommandHandler
    : IRequestHandler<ImportInstrumentResultsCommand, Result<ImportResultSummary>>
{
    private readonly ILimsDbContext _db;
    private readonly IOosDetectionService _oos;

    public ImportInstrumentResultsCommandHandler(ILimsDbContext db, IOosDetectionService oos)
    {
        _db = db;
        _oos = oos;
    }

    public async Task<Result<ImportResultSummary>> Handle(
        ImportInstrumentResultsCommand cmd, CancellationToken ct)
    {
        var execution = await _db.TestExecutions
            .Include(e => e.Sample)
            .FirstOrDefaultAsync(e => e.ExecutionId == cmd.ExecutionId, ct);

        if (execution is null)
            return Result<ImportResultSummary>.Failure("NOT_FOUND", "Test execution not found.");

        int sampleId = execution.SampleId;

        // Load all non-completed executions for the same sample with their parameters
        var sampleExecutions = await _db.TestExecutions
            .Where(e => e.SampleId == sampleId &&
                        e.Status != TestExecutionStatus.Completed &&
                        e.Status != TestExecutionStatus.QCVerified &&
                        e.ParameterId != null)
            .Include(e => e.Parameter)
            .AsNoTracking()
            .ToListAsync(ct);

        // Build lookup: ParameterName (case-insensitive) → (ExecutionId, ParameterId)
        var paramLookup = new Dictionary<string, (int ExecId, int ParamId)>(StringComparer.OrdinalIgnoreCase);
        foreach (var exec in sampleExecutions)
        {
            if (exec.Parameter is not null && !paramLookup.ContainsKey(exec.Parameter.ParameterName))
                paramLookup[exec.Parameter.ParameterName] = (exec.ExecutionId, exec.ParameterId!.Value);
        }

        // Parse CSV
        var csvRows = ParseCsv(cmd.CsvBytes);
        if (csvRows.Count == 0)
            return Result<ImportResultSummary>.Failure("EMPTY_FILE", "CSV file contains no data rows.");

        var resultRows = new List<ImportResultRow>();
        var entries = new List<DigitalLogbookEntry>();

        foreach (var row in csvRows)
        {
            var paramName = GetColumn(row, "ParameterName", "Parameter", "Test", "TestName", "test_name");
            var rawValue  = GetColumn(row, "Result", "Value", "ResultValue", "Reading", "result");

            if (string.IsNullOrWhiteSpace(paramName))
            {
                resultRows.Add(new ImportResultRow("(empty)", rawValue, false, "SKIP", false, false, "Missing parameter name"));
                continue;
            }

            if (!paramLookup.TryGetValue(paramName, out var paramInfo))
            {
                resultRows.Add(new ImportResultRow(paramName, rawValue, false, "SKIP", false, false, "Parameter not found in active executions for this sample"));
                continue;
            }

            // Load parameter with spec limits
            var param = await _db.TestMethodParameters
                .Include(p => p.SpecLimits)
                .FirstOrDefaultAsync(p => p.ParameterId == paramInfo.ParamId, ct);

            if (param is null)
            {
                resultRows.Add(new ImportResultRow(paramName, rawValue, false, "SKIP", false, false, "Parameter definition not found"));
                continue;
            }

            decimal? numericRaw = decimal.TryParse(rawValue,
                System.Globalization.NumberStyles.Any,
                System.Globalization.CultureInfo.InvariantCulture, out var parsed)
                ? parsed : null;

            var specLimit = param.SpecLimits?
                .Where(s => s.IsActive && s.Status == ApprovalStatus.Approved)
                .OrderByDescending(s => s.SpecLimitId)
                .FirstOrDefault();

            var detection = _oos.Detect(
                numericRaw,
                specLimit?.MinValue, specLimit?.MaxValue,
                Array.Empty<decimal>()); // instrument import — trend history not fetched on this path

            entries.Add(new DigitalLogbookEntry
            {
                SampleId             = sampleId,
                ExecutionId          = paramInfo.ExecId,
                ParameterId          = paramInfo.ParamId,
                AnalystId            = cmd.AnalystId,
                TriggerSource        = TriggerType.Manual,
                RawValue             = rawValue ?? string.Empty,
                CalculatedResult     = numericRaw,
                SpecMinSnapshot      = specLimit?.MinValue,
                SpecMaxSnapshot      = specLimit?.MaxValue,
                OotMinSnapshot       = detection.TrendLow,
                OotMaxSnapshot       = detection.TrendHigh,
                RegulatoryTierSnapshot = specLimit?.RegulatoryTier?.ToString(),
                PassFail             = detection.PassFail,
                IsOos                = detection.IsOos,
                IsOot                = detection.IsOot,
                InstrumentId         = execution.InstrumentId,
                Status               = LogbookEntryStatus.Pending,
                CreatedAt            = DateTimeOffset.UtcNow,
            });

            resultRows.Add(new ImportResultRow(paramName, rawValue, true, detection.PassFail, detection.IsOos, detection.IsOot, null));
        }

        _db.DigitalLogbookEntries.AddRange(entries);

        _db.InstrumentImportLogs.Add(new InstrumentImportLog
        {
            ExecutionId      = cmd.ExecutionId,
            FileName         = cmd.FileName,
            TotalRows        = csvRows.Count,
            MatchedRows      = entries.Count,
            SkippedRows      = csvRows.Count - entries.Count,
            ImportedByUserId = cmd.AnalystId,
            ImportedAt       = DateTimeOffset.UtcNow,
        });

        execution.EntryMethod = EntryMethod.FileImport;
        await _db.SaveChangesAsync(ct);

        return Result<ImportResultSummary>.Success(new ImportResultSummary(
            csvRows.Count, entries.Count, csvRows.Count - entries.Count, resultRows));
    }

    private static List<Dictionary<string, string>> ParseCsv(byte[] bytes)
    {
        var text = System.Text.Encoding.UTF8.GetString(bytes);
        var lines = text.Split('\n', StringSplitOptions.RemoveEmptyEntries);
        if (lines.Length < 2) return new();

        var headers = SplitLine(lines[0]);
        var rows = new List<Dictionary<string, string>>();

        for (int i = 1; i < lines.Length; i++)
        {
            var values = SplitLine(lines[i]);
            if (values.All(v => string.IsNullOrWhiteSpace(v))) continue;
            var row = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            for (int j = 0; j < headers.Count && j < values.Count; j++)
                row[headers[j].Trim().Trim('"')] = values[j].Trim().Trim('"');
            rows.Add(row);
        }
        return rows;
    }

    private static List<string> SplitLine(string line)
    {
        var result = new List<string>();
        bool inQuotes = false;
        var cur = new System.Text.StringBuilder();
        foreach (char c in line)
        {
            if (c == '"') inQuotes = !inQuotes;
            else if (c == ',' && !inQuotes) { result.Add(cur.ToString()); cur.Clear(); }
            else cur.Append(c);
        }
        result.Add(cur.ToString().TrimEnd('\r'));
        return result;
    }

    private static string? GetColumn(Dictionary<string, string> row, params string[] candidates)
    {
        foreach (var key in candidates)
            if (row.TryGetValue(key, out var val) && !string.IsNullOrWhiteSpace(val))
                return val;
        return null;
    }
}
