using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.OosInvestigations;

public record GetOosInvestigationsQuery(string? Status, int? LabId, int? ExecutionId) : IRequest<List<OosInvestigationDto>>;

public record OosInvestigationDto(
    int InvestigationId, int ExecutionId, int SampleId, string SampleNumber,
    int ParameterId, string ParameterName,
    string FlagType, string Phase, string Status,
    string? RootCause, string? CapaRef,
    DateTimeOffset OpenedAt, DateTimeOffset? ClosedAt, string CreatedBy);

public class GetOosInvestigationsHandler : IRequestHandler<GetOosInvestigationsQuery, List<OosInvestigationDto>>
{
    private readonly ILimsDbContext _db;
    public GetOosInvestigationsHandler(ILimsDbContext db) => _db = db;

    public async Task<List<OosInvestigationDto>> Handle(GetOosInvestigationsQuery q, CancellationToken ct)
    {
        var query = _db.OosInvestigations
            .Include(i => i.Execution).ThenInclude(e => e.Sample)
            .Include(i => i.Parameter)
            .AsQueryable();

        if (!string.IsNullOrEmpty(q.Status) && Enum.TryParse<OosStatus>(q.Status, out var s))
            query = query.Where(i => i.Status == s);
        if (q.LabId.HasValue) query = query.Where(i => i.Execution.Sample.LabId == q.LabId.Value);
        if (q.ExecutionId.HasValue) query = query.Where(i => i.ExecutionId == q.ExecutionId.Value);

        return await query
            .OrderByDescending(i => i.OpenedAt)
            .Select(i => new OosInvestigationDto(
                i.InvestigationId, i.ExecutionId, i.Execution.SampleId,
                i.Execution.Sample.SampleNumber,
                i.ParameterId, i.Parameter.ParameterName,
                i.FlagType.ToString(), i.Phase.ToString(), i.Status.ToString(),
                i.RootCause, i.CapaRef, i.OpenedAt, i.ClosedAt, i.CreatedBy))
            .ToListAsync(ct);
    }
}
