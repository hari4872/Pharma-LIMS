using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.CoA;

// FR-11: Re-issue creates a new Draft CoA and marks the original as Superseded
// ALCOA+ Enduring — original CoA record is never deleted, just linked via SupersededById
// 21 CFR §11.50: e-signature required — superseding a Released record is a regulated action
public record ReissueCoACommand(
    int OriginalCoaId,
    int QaUserId,
    string Password, string Meaning, string Reason) : IRequest<Result<int>>;

public class ReissueCoAHandler : IRequestHandler<ReissueCoACommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IMasterDataAuditService _audit;
    private readonly IElectronicSignatureService _esig;

    public ReissueCoAHandler(ILimsDbContext db, IMasterDataAuditService audit, IElectronicSignatureService esig)
    { _db = db; _audit = audit; _esig = esig; }

    public async Task<Result<int>> Handle(ReissueCoACommand cmd, CancellationToken ct)
    {
        var original = await _db.Coas
            .Include(c => c.Lines)
            .FirstOrDefaultAsync(c => c.CoaId == cmd.OriginalCoaId, ct);

        if (original is null) return Result<int>.Failure("NOT_FOUND", "CoA not found.");
        if (original.Status == CoaStatus.Superseded)
            return Result<int>.Failure("ALREADY_SUPERSEDED", "CoA has already been superseded.");

        // 21 CFR §11.50: verify e-signature before persisting
        var sig = await _esig.CreateSignatureAsync(cmd.QaUserId, cmd.Password, cmd.Meaning, cmd.Reason, "CoA.Reissue", ct);
        if (sig is null) return Result<int>.Failure("ESIGN_AUTH_FAILED", "Password incorrect — e-signature rejected. (21 CFR §11.300)");

        // CoA ID format: original number with /R suffix (Contract 2: server-generated)
        var newNumber = $"{original.CoaNumber}/R{DateTimeOffset.UtcNow:yyyyMMddHHmm}";

        var newCoa = new Coa
        {
            SampleId        = original.SampleId,
            CoaNumber       = newNumber,
            FormTemplateId  = original.FormTemplateId,
            DeliveryOrderId = original.DeliveryOrderId,
            Status          = CoaStatus.Draft,
            CreatedAt       = DateTimeOffset.UtcNow
        };
        _db.Coas.Add(newCoa);
        await _db.SaveChangesAsync(ct);

        // Copy lines to new CoA
        foreach (var line in original.Lines)
        {
            _db.CoaLines.Add(new CoaLine
            {
                CoaId        = newCoa.CoaId,
                EntryId      = line.EntryId,
                ParameterId  = line.ParameterId,
                DisplayOrder = line.DisplayOrder
            });
        }

        // Mark original as superseded — ALCOA+ Enduring: original is never deleted
        original.Status         = CoaStatus.Superseded;
        original.SupersededById = newCoa.CoaId;

        await _db.SaveChangesAsync(ct);
        await _audit.LogAsync("CoA", newCoa.CoaId, "Reissued",
            new { OriginalCoaId = cmd.OriginalCoaId, original.CoaNumber },
            new { NewCoaId = newCoa.CoaId, newCoa.CoaNumber, cmd.Reason, SignatureId = sig.SignatureId },
            "System");

        return Result<int>.Success(newCoa.CoaId);
    }
}
