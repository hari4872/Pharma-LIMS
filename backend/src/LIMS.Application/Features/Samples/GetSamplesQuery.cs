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

        return await query.OrderByDescending(s => s.CreatedAt)
            .Select(s => new SampleDto(
                s.SampleId, s.SampleNumber,
                s.Material != null ? s.Material.MaterialName : "Unknown",
                s.LotNumber,
                s.SampleTypeNav != null ? s.SampleTypeNav.TypeName : "Unknown",
                s.Status.ToString(), s.BarcodePrinted, s.DueDate,
                s.Analyst != null ? s.Analyst.FullName : "Unassigned",
                s.CreatedAt, s.FormTemplateId,
                s.SpecTemplateId,
                s.SpecTemplate != null ? s.SpecTemplate.TemplateName : null,
                s.SrfSignatureId.HasValue,
                s.IsRush,
                // Normalize legacy "0"/"1"/"2" (stored when column was enum-integer) → readable string
                s.SampleCondition == "0" ? "OK"
                : s.SampleCondition == "1" ? "Damaged"
                : s.SampleCondition == "2" ? "Compromised"
                : s.SampleCondition ?? "OK"))
            .ToListAsync(ct);
    }
}
