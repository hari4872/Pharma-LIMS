using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Infrastructure.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Infrastructure.Services;

// Contract 1: Single named service for excursion impact assessment
// FR-13: flags all samples in storage location during excursion window
// Contract 2: QA notified via SignalR (no polling)
public class ExcursionImpactService : IExcursionImpactService
{
    private readonly ILimsDbContext _db;
    private readonly IHubContext<LimsHub> _hub;

    public ExcursionImpactService(ILimsDbContext db, IHubContext<LimsHub> hub)
    { _db = db; _hub = hub; }

    public async Task<ExcursionImpactResult> AssessImpactAsync(int excursionId, CancellationToken ct = default)
    {
        var excursion = await _db.ConditionExcursions
            .Include(e => e.Location)
            .FirstOrDefaultAsync(e => e.ExcursionId == excursionId, ct)
            ?? throw new InvalidOperationException($"Excursion {excursionId} not found.");

        // Find all samples that were transferred to this location during or before the excursion
        // and not transferred out before the excursion started
        var excursionEnd = excursion.ExcursionEnd ?? DateTimeOffset.UtcNow;

        // Samples currently at this location (last transfer was TO this location within window)
        var affectedSampleIds = await _db.StorageTransferLogs
            .Where(t => t.ToLocationId == excursion.LocationId
                     && t.TransferredAt <= excursionEnd)
            .Select(t => t.SampleId)
            .Distinct()
            .ToListAsync(ct);

        // Also check retain samples directly assigned to this location
        var retainSampleIds = await _db.RetainSamples
            .Where(r => r.LocationId == excursion.LocationId && r.Status == "Active")
            .Select(r => r.SampleId)
            .ToListAsync(ct);

        var allAffected = affectedSampleIds.Union(retainSampleIds).Distinct().ToList();

        // INSERT-only affected sample records
        foreach (var sampleId in allAffected)
        {
            if (!await _db.ExcursionAffectedSamples.AnyAsync(
                    e => e.ExcursionId == excursionId && e.SampleId == sampleId, ct))
            {
                _db.ExcursionAffectedSamples.Add(new ExcursionAffectedSample
                {
                    ExcursionId = excursionId,
                    SampleId = sampleId,
                    FlaggedAt = DateTimeOffset.UtcNow,
                    FlaggedBy = "ExcursionImpactService"
                });
            }
        }
        await _db.SaveChangesAsync(ct);

        // Contract 2: push QA notification via SignalR (no polling)
        await _hub.Clients.Group("QA").SendAsync("ExcursionDetected", new
        {
            excursionId,
            locationCode = excursion.Location.LocationCode,
            excursionType = excursion.ExcursionType.ToString(),
            measuredValue = excursion.MeasuredValue,
            affectedSampleCount = allAffected.Count
        }, ct);

        return new ExcursionImpactResult(excursionId, allAffected.Count, allAffected);
    }
}
