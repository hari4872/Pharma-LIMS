using LIMS.Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.CoA;

// Returns only the PdfBlob for download — separate from GetCoAQuery to avoid loading blob in list views
public record GetCoAPdfQuery(int CoaId) : IRequest<CoaPdfDto?>;
public record CoaPdfDto(int CoaId, byte[]? PdfBlob);

public class GetCoAPdfHandler : IRequestHandler<GetCoAPdfQuery, CoaPdfDto?>
{
    private readonly ILimsDbContext _db;
    public GetCoAPdfHandler(ILimsDbContext db) => _db = db;

    public async Task<CoaPdfDto?> Handle(GetCoAPdfQuery q, CancellationToken ct)
    {
        var coa = await _db.Coas
            .AsNoTracking()
            .Select(c => new { c.CoaId, c.PdfBlob })
            .FirstOrDefaultAsync(c => c.CoaId == q.CoaId, ct);

        return coa is null ? null : new CoaPdfDto(coa.CoaId, coa.PdfBlob);
    }
}
