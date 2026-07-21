using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.TestExecutions;

public record ResultEntryDto(int ParameterId, string RawValue, string? EvidenceFileRef = null, int? InstrumentId = null);

// Step 4–5: Save raw values, run formula + OOS/OOT detection, create Pending logbook entries
public record SubmitTestResultsCommand(
    int ExecutionId, int AnalystId,
    List<ResultEntryDto> Entries,
    EntryMethod EntryMethod = EntryMethod.Manual,
    bool IsAdmin = false) : IRequest<Result<SubmitTestResultsResponse>>;

public record SubmitTestResultsResponse(
    int ExecutionId,
    List<LogbookEntryResult> Results,
    bool HasOos, bool HasOot);

public record LogbookEntryResult(
    int EntryId, int ParameterId, string ParameterName,
    string RawValue, decimal? CalculatedResult, string PassFail,
    bool IsOos, bool IsOot, bool IsCritical, bool HasEvidence,
    decimal? SpecMin = null, decimal? SpecMax = null);

public class SubmitTestResultsHandler : IRequestHandler<SubmitTestResultsCommand, Result<SubmitTestResultsResponse>>
{
    private readonly ILimsDbContext _db;
    private readonly IParameterCalculationService _calc;
    private readonly IOosDetectionService _oos;
    private readonly IAutoCorrectionService _correction;
    private readonly ICalcFormulaService _rounding;

    public SubmitTestResultsHandler(
        ILimsDbContext db,
        IParameterCalculationService calc,
        IOosDetectionService oos,
        IAutoCorrectionService correction,
        ICalcFormulaService rounding)
    {
        _db = db; _calc = calc; _oos = oos; _correction = correction; _rounding = rounding;
    }

    public async Task<Result<SubmitTestResultsResponse>> Handle(SubmitTestResultsCommand cmd, CancellationToken ct)
    {
        var execution = await _db.TestExecutions
            .Include(e => e.Sample)
            .FirstOrDefaultAsync(e => e.ExecutionId == cmd.ExecutionId, ct);
        if (execution is null) return Result<SubmitTestResultsResponse>.Failure("NOT_FOUND", "Execution not found.");
        if (execution.Sample is null)
            return Result<SubmitTestResultsResponse>.Failure("DATA_ERROR", "Sample data could not be loaded.");
        if (!cmd.IsAdmin && execution.AnalystId != cmd.AnalystId)
            return Result<SubmitTestResultsResponse>.Failure("FORBIDDEN", "Not your task.");
        if (execution.Status != TestExecutionStatus.InProgress)
            return Result<SubmitTestResultsResponse>.Failure("INVALID_STATE", "Task must be InProgress to submit results.");

        // Remove any prior Pending entries for this execution (re-submission)
        var priorPending = await _db.DigitalLogbookEntries
            .Where(e => e.ExecutionId == cmd.ExecutionId && e.Status == LogbookEntryStatus.Pending)
            .ToListAsync(ct);
        _db.DigitalLogbookEntries.RemoveRange(priorPending);

        bool hasOos = false, hasOot = false;

        // Batch-fetch OOT history: last 20 Signed, non-OOS results per parameter for this material.
        // Single query across all parameters — avoids N+1 inside the loop.
        var paramIds = cmd.Entries.Select(e => e.ParameterId).ToHashSet();
        var materialId = execution.Sample.MaterialId;
        var rawHistory = await _db.DigitalLogbookEntries
            .Where(e => paramIds.Contains(e.ParameterId)
                     && e.Sample.MaterialId == materialId
                     && e.Status == LogbookEntryStatus.Signed
                     && !e.IsOos
                     && e.CalculatedResult.HasValue
                     && e.SupersededById == null)
            .OrderByDescending(e => e.CreatedAt)
            .Select(e => new { e.ParameterId, Value = e.CalculatedResult!.Value })
            .ToListAsync(ct);

        // Keep only the 20 most-recent per parameter (already ordered desc, take stops at 20)
        var historyByParam = rawHistory
            .GroupBy(e => e.ParameterId)
            .ToDictionary(
                g => g.Key,
                g => (IReadOnlyList<decimal>)g.Take(20).Select(e => e.Value).ToList());

        // Collect (entry entity, param, detection) — save once after loop to avoid partial commits
        var staged = new List<(DigitalLogbookEntry Entry, TestMethodParameter Param, OosDetectionResult Detection)>();

        foreach (var item in cmd.Entries)
        {
            var param = await _db.TestMethodParameters
                .Include(p => p.SpecLimits)
                .FirstOrDefaultAsync(p => p.ParameterId == item.ParameterId, ct);
            if (param is null) continue;

            // Most recently approved spec wins — avoids ambiguous FirstOrDefault when multiple approved limits exist
            var specLimit = param.SpecLimits?
                .Where(s => s.IsActive && s.Status == ApprovalStatus.Approved)
                .OrderByDescending(s => s.SpecLimitId)
                .FirstOrDefault();

            // Auto-correction before formula (Contract 2: server-side, correction table from DB)
            decimal? numericRaw = decimal.TryParse(item.RawValue, out var parsed) ? parsed : null;
            string? correctionDetail = null;
            bool autoCorrected = false;
            if (numericRaw.HasValue)
            {
                var corrResult = await _correction.ApplyAsync(
                    execution.Sample.LabId, param.ParameterName, numericRaw.Value, ct);
                if (corrResult.Applied)
                {
                    numericRaw = corrResult.CorrectedValue;
                    correctionDetail = corrResult.Detail;
                    autoCorrected = true;
                    execution.AutoCorrected = true;
                    execution.CorrectionType = correctionDetail;
                }
            }

            // Formula applied server-side (ALCOA+ Original — result read-only in UI)
            var calculated = numericRaw.HasValue
                ? _calc.Calculate(numericRaw.Value.ToString(), param.CalcFormula, param.FormulaType.ToString())
                : null;

            // Rounding applied after formula (ICH Q2(R1) — MidpointRounding.AwayFromZero)
            if (calculated.HasValue)
                calculated = _rounding.ApplyRounding(calculated.Value, param.DecimalPlaces);

            // OOS / OOT detection — single service for both (Contract 1)
            // History = Signed non-OOS results for same parameter + material (up to 20)
            var history = historyByParam.TryGetValue(item.ParameterId, out var h)
                ? h : Array.Empty<decimal>();
            var detection = _oos.Detect(
                calculated,
                specLimit?.MinValue, specLimit?.MaxValue,
                history);

            if (detection.IsOos) hasOos = true;
            if (detection.IsOot) hasOot = true;

            var logbookEntry = new DigitalLogbookEntry
            {
                SampleId = execution.SampleId,
                ExecutionId = cmd.ExecutionId,
                ParameterId = item.ParameterId,
                TriggerSource = TriggerType.OperatorScan,
                RawValue = item.RawValue,
                CalculatedResult = calculated,
                AutoCorrectionApplied = autoCorrected,
                CorrectionDetail = correctionDetail,
                SpecMinSnapshot = specLimit?.MinValue,
                SpecMaxSnapshot = specLimit?.MaxValue,
                OotMinSnapshot = detection.TrendLow,   // mean - 2σ at detection time (audit trail)
                OotMaxSnapshot = detection.TrendHigh,  // mean + 2σ at detection time (audit trail)
                RegulatoryTierSnapshot = specLimit?.RegulatoryTier?.ToString(),
                PassFail = detection.PassFail,
                IsOos = detection.IsOos,
                IsOot = detection.IsOot,
                InstrumentId = item.InstrumentId ?? execution.InstrumentId,
                AnalystId = cmd.AnalystId,
                EvidenceFileRef = item.EvidenceFileRef,
                Status = LogbookEntryStatus.Pending,
                CreatedAt = DateTimeOffset.UtcNow
            };
            _db.DigitalLogbookEntries.Add(logbookEntry);
            staged.Add((logbookEntry, param, detection));
        }

        // Single atomic commit — all entries succeed or none do
        execution.EntryMethod = cmd.EntryMethod;
        await _db.SaveChangesAsync(ct);

        // Build response AFTER save so EF-generated EntryIds are populated
        var results = staged.Select(s => new LogbookEntryResult(
            s.Entry.EntryId, s.Param.ParameterId, s.Param.ParameterName,
            s.Entry.RawValue, s.Entry.CalculatedResult, s.Detection.PassFail,
            s.Detection.IsOos, s.Detection.IsOot,
            s.Param.IsCritical, s.Entry.EvidenceFileRef is not null,
            s.Entry.SpecMinSnapshot, s.Entry.SpecMaxSnapshot)).ToList();

        return Result<SubmitTestResultsResponse>.Success(
            new SubmitTestResultsResponse(cmd.ExecutionId, results, hasOos, hasOot));
    }
}
