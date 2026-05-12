using LIMS.Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.DeliveryOrders;

public record GetDeliveryOrdersQuery(string? Status) : IRequest<List<DeliveryOrderDto>>;

public record DeliveryOrderDto(
    int DoId, string DoNumber, string? CustomerName,
    string? DespatchDate, string? PackingType,
    string ProductName, string Status,
    DateTimeOffset CreatedAt,
    List<DispatchTaskSummaryDto> Tasks);

public record DispatchTaskSummaryDto(
    int TaskId, string Status, int SampleId, string SampleNumber,
    string FormTemplateName, int? ExecutionId);

public class GetDeliveryOrdersHandler : IRequestHandler<GetDeliveryOrdersQuery, List<DeliveryOrderDto>>
{
    private readonly ILimsDbContext _db;
    public GetDeliveryOrdersHandler(ILimsDbContext db) => _db = db;

    public async Task<List<DeliveryOrderDto>> Handle(GetDeliveryOrdersQuery q, CancellationToken ct)
    {
        var query = _db.DeliveryOrders
            .Include(d => d.Product)
            .Include(d => d.DispatchQcTasks)
                .ThenInclude(t => t.Sample)
            .Include(d => d.DispatchQcTasks)
                .ThenInclude(t => t.FormTemplate)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(q.Status))
            query = query.Where(d => d.Status.ToString() == q.Status);

        var orders = await query.OrderByDescending(d => d.CreatedAt).ToListAsync(ct);

        return orders.Select(d => new DeliveryOrderDto(
            d.DoId, d.DoNumber, d.CustomerName,
            d.DespatchDate?.ToString("yyyy-MM-dd"),
            d.PackingType,
            d.Product.MaterialName,
            d.Status.ToString(),
            d.CreatedAt,
            d.DispatchQcTasks.Select(t => new DispatchTaskSummaryDto(
                t.TaskId, t.Status.ToString(), t.SampleId,
                t.Sample.SampleNumber, t.FormTemplate.FormName,
                t.ExecutionId)).ToList()
        )).ToList();
    }
}
