using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.TestExecutions;

public record BatchExecutionEntry(int ExecutionId, List<ResultEntryDto> Entries);

public record BatchSubmitResultsCommand(
    int AnalystId,
    List<BatchExecutionEntry> Executions) : IRequest<Result<BatchSubmitResponse>>;

public record BatchRowResult(
    int ExecutionId, string SampleNumber,
    List<LogbookEntryResult> Results,
    bool HasOos, bool HasOot, string? Error);

public record BatchSubmitResponse(
    int TotalExecutions, int SuccessCount, int FailCount,
    List<BatchRowResult> Rows);

public class BatchSubmitResultsHandler : IRequestHandler<BatchSubmitResultsCommand, Result<BatchSubmitResponse>>
{
    private readonly ILimsDbContext _db;
    private readonly IParameterCalculationService _calc;
    private readonly IOosDetectionService _oos;
    private readonly IAutoCorrectionService _correction;
    private readonly ICalcFormulaService _rounding;

    public BatchSubmitResultsHandler(ILimsDbContext db, IParameterCalculationService calc,
        IOosDetectionService oos, IAutoCorrectionService correction, ICalcFormulaService rounding)
    { _db = db; _calc = calc; _oos = oos; _correction = correction; _rounding = rounding; }

    public async Task<Result<BatchSubmitResponse>> Handle(BatchSubmitResultsCommand cmd, CancellationToken ct)
    {
        var rows = new List<BatchRowResult>();
        int success = 0, fail = 0;

        foreach (var execEntry in cmd.Executions)
        {
            var execution = await _db.TestExecutions
                .Include(e => e.Sample)
                .FirstOrDefaultAsync(e => e.ExecutionId == execEntry.ExecutionId, ct);

            if (execution is null)
            {
                rows.Add(new BatchRowResult(execEntry.ExecutionId, "?", [], false, false, "Execution not found"));
                fail++; continue;
            }

            if (execution.Sample is null)
            {
                rows.Add(new BatchRowResult(execEntry.ExecutionId, "Unknown", [], false, false, "Sample data could not be loaded."));
                fail++; continue;
            }

            if (execution.Status != TestExecutionStatus.InProgress)
            {
                rows.Add(new BatchRowResult(execEntry.ExecutionId, execution.Sample?.SampleNumber ?? "?", [], false, false, $"Not InProgress (current: {execution.Status})"));
                fail++; continue;
            }

            // Remove prior pending entries for this execution
            var prior = await _db.DigitalLogbookEntries
                .Where(e => e.ExecutionId == execEntry.ExecutionId && e.Status == LogbookEntryStatus.Pending)
                .ToListAsync(ct);
            _db.DigitalLogbookEntries.RemoveRange(prior);

            bool hasOos = false, hasOot = false;
            var staged = new List<(DigitalLogbookEntry Entry, TestMethodParameter Param, OosDetectionResult Detection)>();

            foreach (var item in execEntry.Entries)
            {
                var param = await _db.TestMethodParameters
                    .Include(p => p.SpecLimits)
                    .FirstOrDefaultAsync(p => p.ParameterId == item.ParameterId, ct);
                if (param is null) continue;

                var specLimit = param.SpecLimits?.FirstOrDefault(s => s.IsActive && s.Status == ApprovalStatus.Approved);

                decimal? numericRaw = decimal.TryParse(item.RawValue, out var parsed) ? parsed : null;
                string? correctionDetail = null;
                bool autoCorrected = false;

                if (numericRaw.HasValue)
                {
                    var corrResult = await _correction.ApplyAsync(execution.Sample.LabId, param.ParameterName, numericRaw.Value, ct);
                    if (corrResult.Applied)
                    {
                        numericRaw = corrResult.CorrectedValue;
                        correctionDetail = corrResult.Detail;
                        autoCorrected = true;
                    }
                }

                var calculated = numericRaw.HasValue
                    ? _calc.Calculate(numericRaw.Value.ToString(), param.CalcFormula, param.FormulaType.ToString())
                    : null;

                if (calculated.HasValue)
                    calculated = _rounding.ApplyRounding(calculated.Value, param.DecimalPlaces);

                var detection = _oos.Detect(
                    calculated,
                    specLimit?.MinValue, specLimit?.MaxValue,
                    specLimit?.OotMinValue, specLimit?.OotMaxValue);

                if (detection.IsOos) hasOos = true;
                if (detection.IsOot) hasOot = true;

                var logbookEntry = new DigitalLogbookEntry
                {
                    SampleId              = execution.SampleId,
                    ExecutionId           = execEntry.ExecutionId,
                    ParameterId           = item.ParameterId,
                    TriggerSource         = TriggerType.OperatorScan,
                    RawValue              = item.RawValue,
                    CalculatedResult      = calculated,
                    AutoCorrectionApplied = autoCorrected,
                    CorrectionDetail      = correctionDetail,
                    SpecMinSnapshot       = specLimit?.MinValue,
                    SpecMaxSnapshot       = specLimit?.MaxValue,
                    OotMinSnapshot        = specLimit?.OotMinValue,
                    OotMaxSnapshot        = specLimit?.OotMaxValue,
                    PassFail              = detection.PassFail,
                    IsOos                 = detection.IsOos,
                    IsOot                 = detection.IsOot,
                    InstrumentId          = execution.InstrumentId,
                    AnalystId             = cmd.AnalystId,
                    EvidenceFileRef       = item.EvidenceFileRef,
                    Status                = LogbookEntryStatus.Pending,
                    CreatedAt             = DateTimeOffset.UtcNow,
                };
                _db.DigitalLogbookEntries.Add(logbookEntry);
                staged.Add((logbookEntry, param, detection));
            }

            execution.EntryMethod = EntryMethod.Manual;
            // Per-execution commit: intentional isolation — a failure on execution N does not roll back already-committed entries for N-1
            await _db.SaveChangesAsync(ct);

            var results = staged.Select(s => new LogbookEntryResult(
                s.Entry.EntryId, s.Param.ParameterId, s.Param.ParameterName,
                s.Entry.RawValue, s.Entry.CalculatedResult, s.Detection.PassFail,
                s.Detection.IsOos, s.Detection.IsOot,
                s.Param.IsCritical, s.Entry.EvidenceFileRef is not null)).ToList();

            rows.Add(new BatchRowResult(execEntry.ExecutionId, execution.Sample?.SampleNumber ?? "?", results, hasOos, hasOot, null));
            success++;
        }

        return Result<BatchSubmitResponse>.Success(
            new BatchSubmitResponse(cmd.Executions.Count, success, fail, rows));
    }
}
