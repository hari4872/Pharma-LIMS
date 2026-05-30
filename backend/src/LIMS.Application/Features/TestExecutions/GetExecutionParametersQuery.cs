using LIMS.Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.TestExecutions;

// GET /api/v1/test-executions/{id}/parameters
// Returns only the parameters linked to the checkpoints that were selected for this execution's sample
public record GetExecutionParametersQuery(int ExecutionId) : IRequest<List<ExecutionParameterDto>>;

public record ExecutionParameterDto(
    int ParameterId, string ParameterCode, string ParameterName,
    string Uom, string DataType, bool IsCritical, bool IsMandatory,
    string? InstrumentType, string? ColumnFrequency, string? CalcFormula,
    int? LookupTableId);

public class GetExecutionParametersHandler : IRequestHandler<GetExecutionParametersQuery, List<ExecutionParameterDto>>
{
    private readonly ILimsDbContext _db;
    public GetExecutionParametersHandler(ILimsDbContext db) => _db = db;

    public async Task<List<ExecutionParameterDto>> Handle(GetExecutionParametersQuery q, CancellationToken ct)
    {
        var execution = await _db.TestExecutions
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.ExecutionId == q.ExecutionId, ct);

        if (execution is null) return [];

        // ── Priority 1: Sample has a spec template → use its items' parameters ──────
        // Fetch the sample's SpecTemplateId first (avoids nav-chain SelectMany issues).
        var sampleSpec = await _db.Samples
            .AsNoTracking()
            .Where(s => s.SampleId == execution.SampleId && s.SpecTemplateId != null)
            .Select(s => s.SpecTemplateId)
            .FirstOrDefaultAsync(ct);

        var specParamIds = sampleSpec.HasValue
            ? await _db.SpecTemplateItems
                .Where(sti => sti.SpecTemplateId == sampleSpec.Value)
                .Select(sti => sti.ParameterId)
                .Distinct()
                .ToListAsync(ct)
            : [];

        if (specParamIds.Count > 0)
        {
            return await _db.TestMethodParameters
                .Where(p => specParamIds.Contains(p.ParameterId))
                .AsNoTracking()
                .Select(p => new ExecutionParameterDto(
                    p.ParameterId, p.ParameterCode, p.ParameterName,
                    p.Uom, p.DataType.ToString(), p.IsCritical, p.IsMandatory,
                    p.InstrumentType,
                    p.ColumnFrequency.HasValue ? p.ColumnFrequency.Value.ToString() : null,
                    p.CalcFormula, p.LookupTableId))
                .ToListAsync(ct);
        }

        // ── Priority 2: Execution has a form template → use its scoped parameters ──
        if (execution.FormTemplateId.HasValue)
        {
            var formParamIds = await _db.FormTemplateParameters
                .Where(fp => fp.FormTemplateId == execution.FormTemplateId)
                .Select(fp => fp.ParameterId)
                .Distinct()
                .ToListAsync(ct);

            if (formParamIds.Count > 0)
            {
                return await _db.TestMethodParameters
                    .Where(p => formParamIds.Contains(p.ParameterId))
                    .AsNoTracking()
                    .OrderBy(p => p.ParameterId)
                    .Select(p => new ExecutionParameterDto(
                        p.ParameterId, p.ParameterCode, p.ParameterName,
                        p.Uom, p.DataType.ToString(), p.IsCritical, p.IsMandatory,
                        p.InstrumentType,
                        p.ColumnFrequency.HasValue ? p.ColumnFrequency.Value.ToString() : null,
                        p.CalcFormula, p.LookupTableId))
                    .ToListAsync(ct);
            }
        }

        // ── Priority 3: Fallback — checkpoint parameters (legacy/seeded samples) ───
        return await _db.SampleCheckpoints
            .Where(sc => sc.SampleId == execution.SampleId)
            .Join(_db.CheckpointParameters,
                sc => sc.CheckpointId, cp => cp.CheckpointId,
                (sc, cp) => cp.ParameterId)
            .Distinct()
            .Join(_db.TestMethodParameters,
                pid => pid, p => p.ParameterId, (pid, p) => p)
            .AsNoTracking()
            .Select(p => new ExecutionParameterDto(
                p.ParameterId, p.ParameterCode, p.ParameterName,
                p.Uom, p.DataType.ToString(), p.IsCritical, p.IsMandatory,
                p.InstrumentType,
                p.ColumnFrequency.HasValue ? p.ColumnFrequency.Value.ToString() : null,
                p.CalcFormula, p.LookupTableId))
            .ToListAsync(ct);
    }
}
