using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.Samples;

public record GetSamplesQuery(int? LabId, string? Status, int? AnalystId) : IRequest<List<SampleDto>>;

public record SampleDto(
    int SampleId, string SampleNumber, string MaterialName, string LotNumber,
    string SampleType, string Status, bool BarcodePrinted, DateTimeOffset? DueDate,
    string AnalystName, DateTimeOffset CreatedAt, int? FormTemplateId);

public class GetSamplesQueryHandler : IRequestHandler<GetSamplesQuery, List<SampleDto>>
{
    private readonly ILimsDbContext _db;
    public GetSamplesQueryHandler(ILimsDbContext db) => _db = db;

    public async Task<List<SampleDto>> Handle(GetSamplesQuery request, CancellationToken ct)
    {
        var query = _db.Samples
            .Include(s => s.Material)
            .Include(s => s.Analyst)
            .Include(s => s.SampleTypeNav)              // Gap 2 fix
            .AsQueryable();

        if (request.LabId.HasValue) query = query.Where(s => s.LabId == request.LabId);
        if (!string.IsNullOrEmpty(request.Status) && Enum.TryParse<SampleStatus>(request.Status, out var st))
            query = query.Where(s => s.Status == st);
        if (request.AnalystId.HasValue) query = query.Where(s => s.AnalystId == request.AnalystId);

        return await query.OrderByDescending(s => s.CreatedAt)
            .Select(s => new SampleDto(
                s.SampleId, s.SampleNumber,
                s.Material != null ? s.Material.MaterialName : "Unknown",
                s.LotNumber,
                s.SampleTypeNav != null ? s.SampleTypeNav.TypeName : "Unknown",
                s.Status.ToString(), s.BarcodePrinted, s.DueDate,
                s.Analyst != null ? s.Analyst.FullName : "Unassigned",
                s.CreatedAt, s.FormTemplateId))
            .ToListAsync(ct);
    }
}
