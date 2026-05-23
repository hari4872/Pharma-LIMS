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
        // Resolve sampleId from the execution
        var execution = await _db.TestExecutions
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.ExecutionId == q.ExecutionId, ct);

        if (execution is null)
            return [];

        // Parameters via: Sample → SampleCheckpoints → Checkpoint → CheckpointParameters → TestMethodParameter
        var parameters = await _db.SampleCheckpoints
            .Where(sc => sc.SampleId == execution.SampleId)
            .Join(_db.CheckpointParameters,
                sc  => sc.CheckpointId,
                cp  => cp.CheckpointId,
                (sc, cp) => cp.ParameterId)
            .Distinct()
            .Join(_db.TestMethodParameters,
                pid => pid,
                p   => p.ParameterId,
                (pid, p) => p)
            .AsNoTracking()
            .Select(p => new ExecutionParameterDto(
                p.ParameterId, p.ParameterCode, p.ParameterName,
                p.Uom, p.DataType.ToString(), p.IsCritical, p.IsMandatory,
                p.InstrumentType,
                p.ColumnFrequency.HasValue ? p.ColumnFrequency.Value.ToString() : null,
                p.CalcFormula, p.LookupTableId))
            .ToListAsync(ct);

        return parameters;
    }
}
