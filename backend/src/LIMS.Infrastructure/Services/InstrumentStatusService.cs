using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Infrastructure.Services;

// Contract 1: Single service owns ALL instrument status transitions (FR-12, FR-13)
// Contract 2: In-Use set/cleared server-side based on test executions — React never sets this flag
public class InstrumentStatusService : IInstrumentStatusService
{
    private readonly ILimsDbContext _db;
    private readonly IMasterDataAuditService _audit;

    public InstrumentStatusService(ILimsDbContext db, IMasterDataAuditService audit)
    { _db = db; _audit = audit; }

    public async Task RefreshInUseStatusAsync(int instrumentId, CancellationToken ct = default)
    {
        var instrument = await _db.Instruments.FirstOrDefaultAsync(i => i.InstrumentId == instrumentId, ct);
        if (instrument is null) return;

        // In-Use = any test execution with this instrument is InProgress
        var isInUse = await _db.TestExecutions
            .AnyAsync(e => e.InstrumentId == instrumentId && e.Status == TestExecutionStatus.InProgress, ct);

        if (isInUse && instrument.Status == InstrumentStatus.Available)
            instrument.Status = InstrumentStatus.InUse;
        else if (!isInUse && instrument.Status == InstrumentStatus.InUse)
            instrument.Status = InstrumentStatus.Available;

        await _db.SaveChangesAsync(ct);
    }

    public async Task SetMaintenanceAsync(int instrumentId, string reason, CancellationToken ct = default)
    {
        var instrument = await _db.Instruments.FirstOrDefaultAsync(i => i.InstrumentId == instrumentId, ct);
        if (instrument is null) return;
        // Only set Maintenance if not already OOC (OOC takes precedence)
        if (instrument.Status != InstrumentStatus.OutOfCalibration)
            instrument.Status = InstrumentStatus.Maintenance;
        await _db.SaveChangesAsync(ct);
        await _audit.LogAsync("Instrument", instrumentId, "SetMaintenance",
            new { Status = "Available" },
            new { Status = "Maintenance", Reason = reason },
            "System");
    }

    public async Task ClearMaintenanceAsync(int instrumentId, CancellationToken ct = default)
    {
        var instrument = await _db.Instruments.FirstOrDefaultAsync(i => i.InstrumentId == instrumentId, ct);
        if (instrument is null) return;
        // Only clear Maintenance state (leave OOC intact if applicable)
        if (instrument.Status == InstrumentStatus.Maintenance)
            instrument.Status = InstrumentStatus.Available;
        await _db.SaveChangesAsync(ct);
        await _audit.LogAsync("Instrument", instrumentId, "ClearedMaintenance",
            new { Status = "Maintenance" },
            new { Status = "Available" },
            "System");
    }
}
