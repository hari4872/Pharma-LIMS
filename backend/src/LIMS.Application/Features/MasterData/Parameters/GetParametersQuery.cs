using LIMS.Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.MasterData.Parameters;

public record GetParametersQuery(int? MethodId) : IRequest<List<ParameterDto>>;

public record ParameterDto(int ParameterId, int MethodId, string MethodName, string ParameterName,
    string ParameterCode, string Uom, string DataType, string FormulaType, string? CalcFormula,
    int? LookupTableId, string? InstrumentType, bool IsCritical, bool IsMandatory,
    string? ColumnFrequency, string CreatedBy, DateTimeOffset CreatedAt, int? DecimalPlaces,
    string? InputFields);

public class GetParametersQueryHandler : IRequestHandler<GetParametersQuery, List<ParameterDto>>
{
    private readonly ILimsDbContext _db;
    public GetParametersQueryHandler(ILimsDbContext db) => _db = db;

    public async Task<List<ParameterDto>> Handle(GetParametersQuery request, CancellationToken ct)
    {
        var query = _db.TestMethodParameters.Include(p => p.Method).AsQueryable();
        if (request.MethodId.HasValue) query = query.Where(p => p.MethodId == request.MethodId);

        return await query.Select(p => new ParameterDto(
            p.ParameterId, p.MethodId, p.Method != null ? p.Method.MethodName : "(Deleted)", p.ParameterName, p.ParameterCode,
            p.Uom, p.DataType.ToString(), p.FormulaType.ToString(), p.CalcFormula,
            p.LookupTableId, p.InstrumentType, p.IsCritical, p.IsMandatory,
            p.ColumnFrequency.HasValue ? p.ColumnFrequency.ToString() : null,
            p.CreatedBy, p.CreatedAt, p.DecimalPlaces, p.InputFields)).ToListAsync(ct);
    }
}
