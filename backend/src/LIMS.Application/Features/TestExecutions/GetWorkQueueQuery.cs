using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.TestExecutions;

public record GetWorkQueueQuery(int? AnalystId, int? LabId, string? Status) : IRequest<List<WorkQueueItemDto>>;

public record WorkQueueItemDto(
    int ExecutionId, int SampleId, string SampleNumber, string MaterialName,
    int MaterialId,
    string LotNumber, string AnalystName, string InstrumentCode,
    string Status, int? PriorityScore,
    DateTimeOffset? StartedAt, DateTimeOffset? CompletedAt,
    DateTimeOffset? DueDate, DateTimeOffset CreatedAt);

public class GetWorkQueueHandler : IRequestHandler<GetWorkQueueQuery, List<WorkQueueItemDto>>
{
    private readonly ILimsDbContext _db;
    public GetWorkQueueHandler(ILimsDbContext db) => _db = db;

    public async Task<List<WorkQueueItemDto>> Handle(GetWorkQueueQuery q, CancellationToken ct)
    {
        var query = _db.TestExecutions
            .Include(e => e.Sample).ThenInclude(s => s.Material)
            .Include(e => e.Analyst)
            .Include(e => e.Instrument)
            .AsQueryable();

        if (q.AnalystId.HasValue) query = query.Where(e => e.AnalystId == q.AnalystId.Value);
        if (q.LabId.HasValue) query = query.Where(e => e.Sample.LabId == q.LabId.Value);
        if (!string.IsNullOrEmpty(q.Status))
        {
            // Support comma-separated statuses e.g. "Completed,OOSOpen"
            var statuses = q.Status.Split(',', StringSplitOptions.RemoveEmptyEntries)
                .Select(s => s.Trim())
                .Where(s => Enum.TryParse<TestExecutionStatus>(s, out _))
                .Select(s => Enum.Parse<TestExecutionStatus>(s))
                .ToList();
            if (statuses.Count > 0)
                query = query.Where(e => statuses.Contains(e.Status));
        }

        return await query
            .OrderBy(e => e.PriorityScore.HasValue ? e.PriorityScore.Value : 999)
            .ThenBy(e => e.Sample.DueDate ?? DateTimeOffset.MaxValue)
            .ThenByDescending(e => e.CreatedAt)
            .Select(e => new WorkQueueItemDto(
                e.ExecutionId, e.SampleId, e.Sample.SampleNumber,
                e.Sample.Material != null ? e.Sample.Material.MaterialName : "Unknown",
                e.Sample.MaterialId,
                e.Sample.LotNumber,
                e.Analyst != null ? e.Analyst.FullName : "Unknown",
                e.Instrument != null ? e.Instrument.InstrumentCode : "",
                e.Status.ToString(), e.PriorityScore,
                e.StartedAt, e.CompletedAt,
                e.Sample.DueDate, e.CreatedAt))
            .ToListAsync(ct);
    }
}
