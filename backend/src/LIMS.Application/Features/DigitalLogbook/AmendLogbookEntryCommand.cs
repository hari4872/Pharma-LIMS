using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.DigitalLogbook;

/// <summary>
/// Post-sign amendment — preserves original entry (Superseded), creates new Pending entry.
/// 21 CFR §11.10(e): original immutable; amendment reason + e-sig mandatory.
/// </summary>
public record AmendLogbookEntryCommand(
    int EntryId, int UserId,
    string NewRawValue,
    string AmendmentReason,
    string Password, string Meaning, string Reason) : IRequest<Result<int>>;

public class AmendLogbookEntryHandler : IRequestHandler<AmendLogbookEntryCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IElectronicSignatureService _esig;
    private readonly IParameterCalculationService _calc;
    private readonly IOosDetectionService _oos;

    public AmendLogbookEntryHandler(
        ILimsDbContext db, IElectronicSignatureService esig,
        IParameterCalculationService calc, IOosDetectionService oos)
    { _db = db; _esig = esig; _calc = calc; _oos = oos; }

    public async Task<Result<int>> Handle(AmendLogbookEntryCommand cmd, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(cmd.AmendmentReason))
            return Result<int>.Failure("REASON_REQUIRED", "Amendment reason is mandatory. (21 CFR §11.10(e))");

        var original = await _db.DigitalLogbookEntries
            .Include(e => e.Parameter).ThenInclude(p => p.SpecLimits)
            .Include(e => e.Execution)
            .FirstOrDefaultAsync(e => e.EntryId == cmd.EntryId, ct);

        if (original is null)
            return Result<int>.Failure("NOT_FOUND", "Logbook entry not found.");
        if (original.Status != LogbookEntryStatus.Signed)
            return Result<int>.Failure("INVALID_STATE", "Only Signed entries can be amended.");
        if (original.SupersededById.HasValue)
            return Result<int>.Failure("ALREADY_SUPERSEDED", "This entry has already been superseded by a later amendment.");

        // Role check — analyst (own entry) or QCLead/QA
        if (original.AnalystId != cmd.UserId)
        {
            var requestor = await _db.Users.FirstOrDefaultAsync(u => u.UserId == cmd.UserId, ct);
            if (requestor is null || (requestor.Role != UserRole.QCLead && requestor.Role != UserRole.QA && requestor.Role != UserRole.Admin))
                return Result<int>.Failure("FORBIDDEN", "Only the original analyst or a QC Lead / QA can amend this entry.");
        }

        // §11.300 re-authentication — password independent of session
        var sig = await _esig.CreateSignatureAsync(cmd.UserId, cmd.Password, cmd.Meaning, cmd.Reason,
            "DigitalLogbookEntry.Amend", ct);
        if (sig is null)
            return Result<int>.Failure("ESIGN_AUTH_FAILED", "Password incorrect — e-signature rejected. (21 CFR §11.300)");

        // Recalculate with new raw value
        var specLimit = original.Parameter.SpecLimits?
            .FirstOrDefault(s => s.IsActive && s.Status == ApprovalStatus.Approved);

        decimal? numericRaw = decimal.TryParse(cmd.NewRawValue, out var parsed) ? parsed : null;
        var calculated = numericRaw.HasValue
            ? _calc.Calculate(numericRaw.Value.ToString(), original.Parameter.CalcFormula, original.Parameter.FormulaType.ToString())
            : null;
        var detection = _oos.Detect(calculated,
            specLimit?.MinValue, specLimit?.MaxValue,
            Array.Empty<decimal>()); // amend path — no trend history

        // Create new entry (Pending — must be re-signed by analyst)
        var amended = new DigitalLogbookEntry
        {
            SampleId          = original.SampleId,
            ExecutionId       = original.ExecutionId,
            ParameterId       = original.ParameterId,
            TriggerSource     = original.TriggerSource,
            RawValue          = cmd.NewRawValue,
            CalculatedResult  = calculated,
            SpecMinSnapshot   = original.SpecMinSnapshot,
            SpecMaxSnapshot   = original.SpecMaxSnapshot,
            OotMinSnapshot    = original.OotMinSnapshot,
            OotMaxSnapshot    = original.OotMaxSnapshot,
            RegulatoryTierSnapshot = original.RegulatoryTierSnapshot,
            PassFail          = detection.PassFail,
            IsOos             = detection.IsOos,
            IsOot             = detection.IsOot,
            InstrumentId      = original.InstrumentId,
            AnalystId         = original.AnalystId,
            EvidenceFileRef   = original.EvidenceFileRef,
            Status            = LogbookEntryStatus.Pending,
            AmendmentReason   = cmd.AmendmentReason,
            AmendmentSignatureId = sig.SignatureId,
            CreatedAt         = DateTimeOffset.UtcNow
        };
        _db.DigitalLogbookEntries.Add(amended);

        // Mark original as Superseded (INSERT-only principle — never deleted)
        original.Status = LogbookEntryStatus.Superseded;

        await _db.SaveChangesAsync(ct);

        // Link original → new entry
        original.SupersededById = amended.EntryId;
        await _db.SaveChangesAsync(ct);

        return Result<int>.Success(amended.EntryId);
    }
}
