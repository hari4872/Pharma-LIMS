using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.MasterData.Instruments;

public record GetInstrumentsQuery(int? LabId, string? Status, bool IncludeInactive = false) : IRequest<List<InstrumentDto>>;

public record InstrumentDto(int InstrumentId, int LabId, string LabName, string InstrumentCode,
    string? InstrumentName, string InstrumentType, string? Manufacturer, string? Model,
    string? SerialNumber, string? Location, DateOnly CalibrationDue, DateOnly? LastCalibration,
    string Status, bool IsActive, string CreatedBy, DateTimeOffset CreatedAt);

public class GetInstrumentsQueryHandler : IRequestHandler<GetInstrumentsQuery, List<InstrumentDto>>
{
    private readonly ILimsDbContext _db;
    public GetInstrumentsQueryHandler(ILimsDbContext db) => _db = db;

    public async Task<List<InstrumentDto>> Handle(GetInstrumentsQuery request, CancellationToken ct)
    {
        var query = _db.Instruments.Include(i => i.Lab).AsQueryable();
        if (!request.IncludeInactive) query = query.Where(i => i.IsActive);
        if (request.LabId.HasValue) query = query.Where(i => i.LabId == request.LabId);
        if (!string.IsNullOrEmpty(request.Status) && Enum.TryParse<InstrumentStatus>(request.Status, out var st))
            query = query.Where(i => i.Status == st);

        return await query.Select(i => new InstrumentDto(
            i.InstrumentId, i.LabId, i.Lab != null ? i.Lab.LabName : "Unknown", i.InstrumentCode,
            i.InstrumentName, i.InstrumentType, i.Manufacturer, i.Model,
            i.SerialNumber, i.Location, i.CalibrationDue, i.LastCalibration,
            i.Status.ToString(), i.IsActive, i.CreatedBy, i.CreatedAt)).ToListAsync(ct);
    }
}
