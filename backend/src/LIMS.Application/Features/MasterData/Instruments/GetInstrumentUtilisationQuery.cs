using LIMS.Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.MasterData.Instruments;

// FR-15: Expose instrument utilisation summaries computed by UtilisationSummaryJob (Contract 2)
public record GetInstrumentUtilisationQuery(int InstrumentId) : IRequest<List<UtilisationSummaryDto>>;

public record UtilisationSummaryDto(
    int SummaryId,
    int WindowDays,
    DateTimeOffset WindowStart,
    DateTimeOffset WindowEnd,
    int TotalTests,
    decimal TotalHours,
    decimal? UtilisationPct,
    DateTimeOffset CalculatedAt);

public class GetInstrumentUtilisationQueryHandler : IRequestHandler<GetInstrumentUtilisationQuery, List<UtilisationSummaryDto>>
{
    private readonly ILimsDbContext _db;
    public GetInstrumentUtilisationQueryHandler(ILimsDbContext db) => _db = db;

    public async Task<List<UtilisationSummaryDto>> Handle(GetInstrumentUtilisationQuery request, CancellationToken ct)
    {
        return await _db.InstrumentUtilisationSummaries
            .Where(s => s.InstrumentId == request.InstrumentId)
            .OrderBy(s => s.WindowDays)
            .Select(s => new UtilisationSummaryDto(
                s.SummaryId,
                s.WindowDays,
                s.WindowStart,
                s.WindowEnd,
                s.TotalTests,
                s.TotalHours,
                s.UtilisationPct,
                s.CalculatedAt))
            .ToListAsync(ct);
    }
}
