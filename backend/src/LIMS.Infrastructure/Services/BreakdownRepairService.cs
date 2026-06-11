using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Domain.Enums;
using LIMS.Infrastructure.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Infrastructure.Services;

// Contract 1: Single named service for the full breakdown/repair lifecycle (FR-10)
// Each step atomically owns its state transition
public class BreakdownRepairService : IBreakdownRepairService
{
    private readonly ILimsDbContext _db;
    private readonly IInstrumentStatusService _statusService;
    private readonly IOOCImpactService _oocImpact;
    private readonly IHubContext<LimsHub> _hub;

    public BreakdownRepairService(ILimsDbContext db, IInstrumentStatusService statusService,
        IOOCImpactService oocImpact, IHubContext<LimsHub> hub)
    { _db = db; _statusService = statusService; _oocImpact = oocImpact; _hub = hub; }

    public async Task<BreakdownResult> RaiseBreakdownAsync(
        int instrumentId, int raisedByUserId, string issueDescription, CancellationToken ct = default)
    {
        var instrument = await _db.Instruments.FirstOrDefaultAsync(i => i.InstrumentId == instrumentId && i.IsActive, ct)
            ?? throw new InvalidOperationException($"Instrument {instrumentId} not found.");

        var user = await _db.Users.FirstOrDefaultAsync(u => u.UserId == raisedByUserId, ct)
            ?? throw new InvalidOperationException("User not found.");

        var breakdown = new InstrumentBreakdown
        {
            InstrumentId = instrumentId,
            RaisedBy = raisedByUserId,
            RaisedAt = DateTimeOffset.UtcNow,
            IssueDescription = issueDescription,
            Status = BreakdownStatus.Open
        };
        _db.InstrumentBreakdowns.Add(breakdown);
        await _db.SaveChangesAsync(ct);

        // Contract 1: InstrumentStatusService owns the status transition
        await _statusService.SetMaintenanceAsync(instrumentId, $"Breakdown #{breakdown.BreakdownId}", ct);

        // Contract 2: push QA + Lab Manager notification via SignalR
        await _hub.Clients.Groups("QA", "LabManager").SendAsync("InstrumentBreakdownRaised", new
        {
            breakdownId = breakdown.BreakdownId,
            instrumentCode = instrument.InstrumentCode,
            raisedBy = user.FullName,
            issueDescription
        }, ct);

        return new BreakdownResult(breakdown.BreakdownId, InstrumentStatus.Maintenance.ToString());
    }

    public async Task<int> RecordRepairAsync(int breakdownId, string technician, DateOnly repairDate,
        string repairDescription, string? partsUsed, string recordedBy, CancellationToken ct = default)
    {
        var breakdown = await _db.InstrumentBreakdowns.FirstOrDefaultAsync(b => b.BreakdownId == breakdownId, ct)
            ?? throw new InvalidOperationException($"Breakdown {breakdownId} not found.");

        if (breakdown.Status == BreakdownStatus.Resolved)
            throw new InvalidOperationException("Cannot add repair to a resolved breakdown.");

        var repair = new InstrumentRepair
        {
            BreakdownId = breakdownId,
            Technician = technician,
            RepairDate = repairDate,
            RepairDescription = repairDescription,
            PartsUsed = partsUsed,
            RecordedBy = recordedBy,
            RecordedAt = DateTimeOffset.UtcNow
        };
        _db.InstrumentRepairs.Add(repair);
        breakdown.Status = BreakdownStatus.InRepair;
        await _db.SaveChangesAsync(ct);
        return repair.RepairId;
    }

    public async Task<ReturnToServiceResult> ReturnToServiceAsync(
        int breakdownId, int qaUserId, string password, string meaning, string reason,
        CancellationToken ct = default)
    {
        var breakdown = await _db.InstrumentBreakdowns
            .Include(b => b.Instrument)
            .FirstOrDefaultAsync(b => b.BreakdownId == breakdownId, ct)
            ?? throw new InvalidOperationException($"Breakdown {breakdownId} not found.");

        if (breakdown.Status == BreakdownStatus.Resolved)
            throw new InvalidOperationException("Breakdown is already resolved.");

        // 21 CFR §11.300 — BCrypt independent of session
        var qaUser = await _db.Users.FirstOrDefaultAsync(u => u.UserId == qaUserId, ct)
            ?? throw new InvalidOperationException("QA user not found.");
        if (!BCrypt.Net.BCrypt.Verify(password, qaUser.PasswordHash))
            throw new UnauthorizedAccessException("E-signature authentication failed.");

        // §11.50: full_name + signed_at UTC + meaning + reason
        var sig = new ElectronicSignature
        {
            UserId = qaUserId, FullName = qaUser.FullName,
            SignedAt = DateTimeOffset.UtcNow, Meaning = meaning, Reason = reason,
            ActionType = "InstrumentReturnToService"
        };
        _db.ElectronicSignatures.Add(sig);
        await _db.SaveChangesAsync(ct);

        breakdown.Status = BreakdownStatus.Resolved;
        breakdown.ReturnSignatureId = sig.SignatureId;
        await _db.SaveChangesAsync(ct);

        // Contract 1: InstrumentStatusService clears Maintenance → Available
        await _statusService.ClearMaintenanceAsync(breakdown.InstrumentId, ct);

        // FR-16: OOCImpactService checks breakdown window (same service as cal-OOC — Contract 1)
        var oocResult = await _oocImpact.FlagBreakdownOOCAsync(breakdownId, ct);

        return new ReturnToServiceResult(breakdownId, sig.SignatureId, oocResult.AffectedEntryCount > 0, oocResult.AffectedEntryCount);
    }
}
