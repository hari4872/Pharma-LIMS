using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.OosInvestigations;

// Manual creation of an OOS/OOT investigation from an existing logbook entry.
// Auto-creation path: SignOffTestExecutionCommand (triggered when IsOos/IsOot = true).
// Manual path: QA manually flags an entry for investigation (e.g., missed by auto-trigger or OOT trend review).
public record CreateOosInvestigationCommand(int EntryId, string FlagType, string CreatedBy) : IRequest<Result<int>>;

public class CreateOosInvestigationHandler : IRequestHandler<CreateOosInvestigationCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    public CreateOosInvestigationHandler(ILimsDbContext db) => _db = db;

    public async Task<Result<int>> Handle(CreateOosInvestigationCommand cmd, CancellationToken ct)
    {
        if (!Enum.TryParse<OosFlag>(cmd.FlagType, out var flag))
            return Result<int>.Failure("INVALID_FLAG", "FlagType must be OOS or OOT.");

        var entry = await _db.DigitalLogbookEntries
            .FirstOrDefaultAsync(e => e.EntryId == cmd.EntryId, ct);

        if (entry is null)
            return Result<int>.Failure("NOT_FOUND", "Logbook entry not found.");

        // Guard: prevent duplicate investigations for the same entry
        var alreadyExists = await _db.OosInvestigations
            .AnyAsync(i => i.EntryId == cmd.EntryId, ct);
        if (alreadyExists)
            return Result<int>.Failure("DUPLICATE", "An investigation already exists for this logbook entry.");

        var investigation = new OosInvestigation
        {
            ExecutionId = entry.ExecutionId,
            EntryId     = entry.EntryId,
            ParameterId = entry.ParameterId,
            FlagType    = flag,
            Phase       = OosPhase.Phase1,
            Status      = OosStatus.Open,
            CreatedBy   = cmd.CreatedBy,
            OpenedAt    = DateTimeOffset.UtcNow,
        };
        _db.OosInvestigations.Add(investigation);
        await _db.SaveChangesAsync(ct);
        return Result<int>.Success(investigation.InvestigationId);
    }
}
