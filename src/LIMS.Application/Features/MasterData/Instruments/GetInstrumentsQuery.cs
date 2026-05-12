using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.MasterData.Instruments;

public record GetInstrumentsQuery(int? LabId, string? Status, bool IncludeInactive = false) : IRequest<List<InstrumentDto>>;

public record InstrumentDto(int InstrumentId, int LabId, string LabName, string InstrumentCode,
    string InstrumentType, string? Model, string? SerialNumber, DateOnly CalibrationDue,
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
            i.InstrumentId, i.LabId, i.Lab.LabName, i.InstrumentCode, i.InstrumentType,
            i.Model, i.SerialNumber, i.CalibrationDue, i.Status.ToString(),
            i.IsActive, i.CreatedBy, i.CreatedAt)).ToListAsync(ct);
    }
}
