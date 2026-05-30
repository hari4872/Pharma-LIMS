using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.Samples;

public record GetSamplesQuery(int? LabId, string? Status, int? AnalystId) : IRequest<List<SampleDto>>;

public record SampleDto(
    int SampleId, string SampleNumber, string MaterialName, string LotNumber,
    string SampleType, string Status, bool BarcodePrinted, DateTimeOffset? DueDate,
    string AnalystName, DateTimeOffset CreatedAt, int? FormTemplateId,
    int? SpecTemplateId, string? SpecTemplateName, bool SrfSigned,
    bool IsRush, string? SampleCondition);

public class GetSamplesQueryHandler : IRequestHandler<GetSamplesQuery, List<SampleDto>>
{
    private readonly ILimsDbContext _db;
    public GetSamplesQueryHandler(ILimsDbContext db) => _db = db;

    public async Task<List<SampleDto>> Handle(GetSamplesQuery request, CancellationToken ct)
    {
        var query = _db.Samples
            .Include(s => s.Material)
            .Include(s => s.Analyst)
            .Include(s => s.SampleTypeNav)
            .Include(s => s.SpecTemplate)
            .AsNoTracking()
            .AsQueryable();

        if (request.LabId.HasValue) query = query.Where(s => s.LabId == request.LabId);
        if (!string.IsNullOrEmpty(request.Status) && Enum.TryParse<SampleStatus>(request.Status, out var st))
            query = query.Where(s => s.Status == st);
        if (request.AnalystId.HasValue) query = query.Where(s => s.AnalystId == request.AnalystId);

        // Project nullable enum SampleCondition as its raw value in SQL, then convert
        // to string in memory. Calling .ToString() on a nullable enum inside EF LINQ can
        // cause Npgsql to attempt an integer read on a text column (EF Core 8 ClrType quirk).
        var rows = await query.OrderByDescending(s => s.CreatedAt)
            .Select(s => new
            {
                s.SampleId, s.SampleNumber,
                MaterialName     = s.Material != null ? s.Material.MaterialName : "Unknown",
                s.LotNumber,
                SampleType       = s.SampleTypeNav != null ? s.SampleTypeNav.TypeName : "Unknown",
                Status           = s.Status.ToString(),
                s.BarcodePrinted, s.DueDate,
                AnalystName      = s.Analyst != null ? s.Analyst.FullName : "Unassigned",
                s.CreatedAt, s.FormTemplateId,
                s.SpecTemplateId,
                SpecTemplateName = s.SpecTemplate != null ? s.SpecTemplate.TemplateName : null,
                SrfSigned        = s.SrfSignatureId.HasValue,
                s.IsRush,
                s.SampleCondition  // project as enum — converted to string below in C#
            })
            .ToListAsync(ct);

        return rows.Select(r => new SampleDto(
            r.SampleId, r.SampleNumber, r.MaterialName, r.LotNumber,
            r.SampleType, r.Status, r.BarcodePrinted, r.DueDate,
            r.AnalystName, r.CreatedAt, r.FormTemplateId,
            r.SpecTemplateId, r.SpecTemplateName, r.SrfSigned,
            r.IsRush,
            r.SampleCondition?.ToString()   // safe: runs in C# memory, not SQL
        )).ToList();
    }
}
