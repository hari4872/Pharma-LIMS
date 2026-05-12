using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.MasterData.TestMethods;

public record GetTestMethodsQuery(string? StatusFilter = null, bool IncludeInactive = false) : IRequest<List<TestMethodDto>>;

public record TestMethodDto(int MethodId, string MethodCode, string MethodName, string? SopReference, string Status, string Version, string? ApprovedBy, DateTimeOffset? ApprovedAt, bool IsActive, DateTimeOffset CreatedAt, int ParameterCount);

public class GetTestMethodsHandler : IRequestHandler<GetTestMethodsQuery, List<TestMethodDto>>
{
    private readonly ILimsDbContext _db;
    public GetTestMethodsHandler(ILimsDbContext db) => _db = db;

    public async Task<List<TestMethodDto>> Handle(GetTestMethodsQuery request, CancellationToken cancellationToken)
    {
        var query = _db.TestMethods.Include(m => m.Parameters).AsQueryable();
        if (!request.IncludeInactive) query = query.Where(m => m.IsActive);
        if (!string.IsNullOrEmpty(request.StatusFilter) && Enum.TryParse<ApprovalStatus>(request.StatusFilter, out var status))
            query = query.Where(m => m.Status == status);

        return await query
            .OrderBy(m => m.MethodCode)
            .Select(m => new TestMethodDto(m.MethodId, m.MethodCode, m.MethodName, m.SopReference, m.Status.ToString(), m.Version, m.ApprovedBy, m.ApprovedAt, m.IsActive, m.CreatedAt, m.Parameters.Count))
            .ToListAsync(cancellationToken);
    }
}
