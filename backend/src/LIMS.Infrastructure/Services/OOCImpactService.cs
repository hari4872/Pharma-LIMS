using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using LIMS.Infrastructure.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Infrastructure.Services;

// Contract 1: Single named service for ALL OOC flagging (FR-05, FR-16)
// Cal-OOC and Breakdown-OOC both use this service — no duplication
public class OOCImpactService : IOOCImpactService
{
    private readonly ILimsDbContext _db;
    private readonly IHubContext<LimsHub> _hub;

    public OOCImpactService(ILimsDbContext db, IHubContext<LimsHub> hub) { _db = db; _hub = hub; }

    public async Task<OOCImpactResult> FlagCalOOCAsync(int instrumentId, CancellationToken ct = default)
    {
        // Find the last approved calibration date
        // Approved calibration = has an e-signature (QA signs off on CalibrationApprove)
        var lastApprovedCal = await _db.CalibrationRecords
            .Where(c => c.InstrumentId == instrumentId && c.SignatureId != null)
            .OrderByDescending(c => c.CalibrationDate)
            .Select(c => (DateOnly?)c.CalibrationDate)
            .FirstOrDefaultAsync(ct);

        // All logbook entries after last approved calibration (or all if no cal on record)
        var cutoffDate = lastApprovedCal.HasValue
            ? new DateTimeOffset(lastApprovedCal.Value.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero)
            : DateTimeOffset.MinValue;

        var affectedEntryIds = await _db.DigitalLogbookEntries
            .Where(e => e.InstrumentId == instrumentId
                     && e.CreatedAt >= cutoffDate
                     && e.Status != LogbookEntryStatus.Superseded)
            .Select(e => e.EntryId)
            .ToListAsync(ct);

        await PushOOCNotificationAsync(instrumentId, "CalibrationExpiry", affectedEntryIds.Count, ct);
        return new OOCImpactResult(instrumentId, "CalibrationOOC", affectedEntryIds.Count, affectedEntryIds);
    }

    public async Task<OOCImpactResult> FlagBreakdownOOCAsync(int breakdownId, CancellationToken ct = default)
    {
        var breakdown = await _db.InstrumentBreakdowns
            .Include(b => b.Instrument)
            .FirstOrDefaultAsync(b => b.BreakdownId == breakdownId, ct);
        if (breakdown is null) return new OOCImpactResult(0, "BreakdownOOC", 0, []);

        // Flag logbook rows used during the breakdown window [raised_at, resolved_at / now]
        var windowEnd = DateTimeOffset.UtcNow;

        var affectedEntryIds = await _db.DigitalLogbookEntries
            .Where(e => e.InstrumentId == breakdown.InstrumentId
                     && e.CreatedAt >= breakdown.RaisedAt
                     && e.CreatedAt <= windowEnd
                     && e.Status != LogbookEntryStatus.Superseded)
            .Select(e => e.EntryId)
            .ToListAsync(ct);

        await PushOOCNotificationAsync(breakdown.InstrumentId, "BreakdownWindow", affectedEntryIds.Count, ct);
        return new OOCImpactResult(breakdown.InstrumentId, "BreakdownOOC", affectedEntryIds.Count, affectedEntryIds);
    }

    private async Task PushOOCNotificationAsync(int instrumentId, string triggerType, int count, CancellationToken ct)
    {
        if (count == 0) return;
        var instrument = await _db.Instruments.FirstOrDefaultAsync(i => i.InstrumentId == instrumentId, ct);
        // Contract 2: push via SignalR (FR-08)
        await _hub.Clients.Groups("QA", "LabManager").SendAsync("InstrumentOOC", new
        {
            instrumentId,
            instrumentCode = instrument?.InstrumentCode,
            triggerType,
            affectedEntryCount = count
        }, ct);
    }
}
