using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.OosInvestigations;

public record GetOosInvestigationsQuery(string? Status, int? LabId, int? ExecutionId, int? SampleId = null) : IRequest<List<OosInvestigationDto>>;

public record OosInvestigationDto(
    int InvestigationId, int ExecutionId, int SampleId, string SampleNumber,
    int ParameterId, string ParameterName,
    string FlagType, string Phase, string Status,
    string? RootCause, string? CapaRef, string? CapaStatus,
    DateTimeOffset OpenedAt, DateTimeOffset? ClosedAt, string CreatedBy,
    int? RetestExecutionId, string? ResolutionType,
    // Group C — Genuine OOS rework path
    int? ReworkExecutionId, int? PostReworkRetestExecutionId, string? FinalDecision,
    bool RetestCompleted = false,
    bool PostReworkRetestCompleted = false,
    // Unit-level inspection
    string InspectionScope = "SampleBased",
    decimal? UnitReleasedQty = null,
    decimal? UnitScrappedQty = null);

public class GetOosInvestigationsHandler : IRequestHandler<GetOosInvestigationsQuery, List<OosInvestigationDto>>
{
    private readonly ILimsDbContext _db;
    public GetOosInvestigationsHandler(ILimsDbContext db) => _db = db;

    public async Task<List<OosInvestigationDto>> Handle(GetOosInvestigationsQuery q, CancellationToken ct)
    {
        var query = _db.OosInvestigations
            .Include(i => i.Execution).ThenInclude(e => e.Sample)
            .Include(i => i.Parameter)
            .Include(i => i.RetestExecution)
            .Include(i => i.PostReworkRetestExecution)
            .AsQueryable();

        if (!string.IsNullOrEmpty(q.Status) && Enum.TryParse<OosStatus>(q.Status, out var s))
            query = query.Where(i => i.Status == s);
        if (q.LabId.HasValue) query = query.Where(i => i.Execution.Sample.LabId == q.LabId.Value);
        if (q.ExecutionId.HasValue) query = query.Where(i => i.ExecutionId == q.ExecutionId.Value);
        if (q.SampleId.HasValue)   query = query.Where(i => i.Execution.SampleId == q.SampleId.Value);

        return await query
            .OrderByDescending(i => i.OpenedAt)
            .Select(i => new OosInvestigationDto(
                i.InvestigationId, i.ExecutionId, i.Execution != null ? i.Execution.SampleId : 0,
                i.Execution != null && i.Execution.Sample != null ? i.Execution.Sample.SampleNumber : "",
                i.ParameterId, i.Parameter != null ? i.Parameter.ParameterName : "Unknown",
                i.FlagType.ToString(), i.Phase.ToString(), i.Status.ToString(),
                i.RootCause, i.CapaRef, i.CapaStatus, i.OpenedAt, i.ClosedAt, i.CreatedBy,
                i.RetestExecutionId, i.ResolutionType != null ? i.ResolutionType.ToString() : null,
                i.ReworkExecutionId, i.PostReworkRetestExecutionId,
                i.FinalDecision != null ? i.FinalDecision.ToString() : null,
                i.RetestExecution != null && i.RetestExecution.Status == TestExecutionStatus.Completed,
                i.PostReworkRetestExecution != null && i.PostReworkRetestExecution.Status == TestExecutionStatus.Completed,
                i.Parameter != null ? i.Parameter.InspectionScope.ToString() : "SampleBased",
                i.UnitReleasedQty, i.UnitScrappedQty))
            .ToListAsync(ct);
    }
}
