using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.DispatchQc;

public record GetDispatchQcTasksQuery(string? Status, int? DoId) : IRequest<List<DispatchQcTaskDto>>;

public record DispatchQcTaskDto(
    int TaskId, int DoId, string DoNumber, string? CustomerName,
    int SampleId, string SampleNumber, string MaterialName, string LotNumber,
    string FormTemplateName, int? ExecutionId, string Status,
    DateTimeOffset CreatedAt);

public class GetDispatchQcTasksHandler : IRequestHandler<GetDispatchQcTasksQuery, List<DispatchQcTaskDto>>
{
    private readonly ILimsDbContext _db;
    public GetDispatchQcTasksHandler(ILimsDbContext db) => _db = db;

    public async Task<List<DispatchQcTaskDto>> Handle(GetDispatchQcTasksQuery q, CancellationToken ct)
    {
        var query = _db.DispatchQcTasks
            .Include(t => t.DeliveryOrder)
            .Include(t => t.Sample).ThenInclude(s => s.Material)
            .Include(t => t.FormTemplate)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(q.Status))
        if (!string.IsNullOrWhiteSpace(q.Status) && Enum.TryParse<DispatchTaskStatus>(q.Status, true, out var taskStatusEnum))
            query = query.Where(t => t.Status == taskStatusEnum);
        if (q.DoId.HasValue)
            query = query.Where(t => t.DoId == q.DoId.Value);

        var tasks = await query.OrderByDescending(t => t.CreatedAt).ToListAsync(ct);

        return tasks.Select(t => new DispatchQcTaskDto(
            t.TaskId, t.DoId,
            t.DeliveryOrder != null ? t.DeliveryOrder.DoNumber : "",
            t.DeliveryOrder?.CustomerName,
            t.SampleId, t.Sample.SampleNumber,
            t.Sample.Material != null ? t.Sample.Material.MaterialName : "Unknown",
            t.Sample.LotNumber,
            t.FormTemplate != null ? t.FormTemplate.FormName : "Unknown",
            t.ExecutionId, t.Status.ToString(), t.CreatedAt
        )).ToList();
    }
}
