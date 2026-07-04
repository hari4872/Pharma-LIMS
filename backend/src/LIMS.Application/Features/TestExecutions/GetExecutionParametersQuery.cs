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
    int? LookupTableId, string? InputFields, int? DecimalPlaces);

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

        // ── Spec-engine executions: each execution owns exactly one parameter ─────
        // When ParameterId is set the spec engine already denormalised the correct
        // parameter for this execution — return it directly to prevent every
        // execution showing the full template parameter set (causes duplicate entry).
        if (execution.ParameterId.HasValue)
        {
            return await _db.TestMethodParameters
                .Where(p => p.ParameterId == execution.ParameterId.Value)
                .AsNoTracking()
                .Select(p => new ExecutionParameterDto(
                    p.ParameterId, p.ParameterCode, p.ParameterName,
                    p.Uom, p.DataType.ToString(), p.IsCritical, p.IsMandatory,
                    p.InstrumentType,
                    p.ColumnFrequency.HasValue ? p.ColumnFrequency.Value.ToString() : null,
                    p.CalcFormula, p.LookupTableId, p.InputFields, p.DecimalPlaces))
                .ToListAsync(ct);
        }

        // ── Method-level executions (LabVantage model): one execution per test method ─
        // When the spec template item has TestMethodId (no ParameterId), return ALL
        // parameters belonging to that method so the analyst sees the full group.
        if (execution.SpecTemplateItemId.HasValue)
        {
            var methodId = await _db.SpecTemplateItems
                .AsNoTracking()
                .Where(i => i.SpecTemplateItemId == execution.SpecTemplateItemId.Value
                         && i.TestMethodId != null)
                .Select(i => i.TestMethodId)
                .FirstOrDefaultAsync(ct);

            if (methodId.HasValue)
            {
                return await _db.TestMethodParameters
                    .Where(p => p.MethodId == methodId.Value)
                    .AsNoTracking()
                    .OrderBy(p => p.ParameterId)
                    .Select(p => new ExecutionParameterDto(
                        p.ParameterId, p.ParameterCode, p.ParameterName,
                        p.Uom, p.DataType.ToString(), p.IsCritical, p.IsMandatory,
                        p.InstrumentType,
                        p.ColumnFrequency.HasValue ? p.ColumnFrequency.Value.ToString() : null,
                        p.CalcFormula, p.LookupTableId, p.InputFields, p.DecimalPlaces))
                    .ToListAsync(ct);
            }
        }

        // ── Fallback: manual/legacy executions (no ParameterId) ───────────────────
        // Fetch spec template parameter IDs for this sample
        var sampleSpec = await _db.Samples
            .AsNoTracking()
            .Where(s => s.SampleId == execution.SampleId && s.SpecTemplateId != null)
            .Select(s => s.SpecTemplateId)
            .FirstOrDefaultAsync(ct);

        var specParamIds = sampleSpec.HasValue
            ? (await _db.SpecTemplateItems
                .Where(sti => sti.SpecTemplateId == sampleSpec.Value && sti.ParameterId != null)
                .Select(sti => sti.ParameterId)
                .Distinct()
                .ToListAsync(ct))
                .Where(id => id.HasValue)
                .Select(id => id!.Value)
                .ToList()
            : new List<int>();

        // ── Fetch checkpoint parameter IDs for this sample ─────────────────────────
        var checkpointParamIds = await _db.SampleCheckpoints
            .Where(sc => sc.SampleId == execution.SampleId)
            .Join(_db.CheckpointParameters,
                sc => sc.CheckpointId, cp => cp.CheckpointId,
                (sc, cp) => cp.ParameterId)
            .Distinct()
            .ToListAsync(ct);

        // ── UNION: If sample has checkpoint links + spec template → merge both ──────
        // If checkpoint-only → use checkpoint params
        // If spec-only → use spec params
        // If both → UNION (checkpoint params + spec params, no duplicates)
        var unionParamIds = checkpointParamIds.Count > 0 && specParamIds.Count > 0
            ? specParamIds.Union(checkpointParamIds).Distinct().ToList()
            : specParamIds.Count > 0
                ? specParamIds
                : checkpointParamIds;

        if (unionParamIds.Count > 0)
        {
            return await _db.TestMethodParameters
                .Where(p => unionParamIds.Contains(p.ParameterId))
                .AsNoTracking()
                .OrderBy(p => p.ParameterId)
                .Select(p => new ExecutionParameterDto(
                    p.ParameterId, p.ParameterCode, p.ParameterName,
                    p.Uom, p.DataType.ToString(), p.IsCritical, p.IsMandatory,
                    p.InstrumentType,
                    p.ColumnFrequency.HasValue ? p.ColumnFrequency.Value.ToString() : null,
                    p.CalcFormula, p.LookupTableId, p.InputFields, p.DecimalPlaces))
                .ToListAsync(ct);
        }

        // ── Fallback: Form Template parameters (no spec, no checkpoints) ───────────
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
                        p.CalcFormula, p.LookupTableId, p.InputFields, p.DecimalPlaces))
                    .ToListAsync(ct);
            }
        }

        return [];
    }
}
