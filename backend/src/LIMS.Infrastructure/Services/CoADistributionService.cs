using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;

namespace LIMS.Infrastructure.Services;

// Contract 1: Single sender — ERP + Archive (no duplicate distribution path)
// Distribution log INSERT-only — never update/delete
public class CoADistributionService : ICoADistributionService
{
    private readonly ILimsDbContext _db;
    public CoADistributionService(ILimsDbContext db) => _db = db;

    public async Task DistributeAsync(int coaId, CancellationToken ct = default)
    {
        // ERP notification (stub — real integration in Phase 9 ERP module)
        _db.CoaDistributionLogs.Add(new CoaDistributionLog
        {
            CoaId   = coaId,
            Channel = "ERP",
            SentAt  = DateTimeOffset.UtcNow,
            Status  = "Sent"
        });

        // Archive (stub — real archival service in Phase 9)
        _db.CoaDistributionLogs.Add(new CoaDistributionLog
        {
            CoaId   = coaId,
            Channel = "Archive",
            SentAt  = DateTimeOffset.UtcNow,
            Status  = "Sent"
        });

        await _db.SaveChangesAsync(ct);
    }
}
