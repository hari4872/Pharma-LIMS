using FluentValidation;
using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.Samples;

// FR-18: Barcode re-print — audit-logged with who + reason (21 CFR §11.10(e))
public record ReprintBarcodeCommand(int SampleId, string Reason, string PrintedBy) : IRequest<Result<int>>;

public class ReprintBarcodeValidator : AbstractValidator<ReprintBarcodeCommand>
{
    public ReprintBarcodeValidator()
    {
        RuleFor(x => x.SampleId).GreaterThan(0);
        RuleFor(x => x.Reason).NotEmpty().WithMessage("Reason is required for barcode reprint.");
    }
}

public class ReprintBarcodeCommandHandler : IRequestHandler<ReprintBarcodeCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IMasterDataAuditService _audit;
    public ReprintBarcodeCommandHandler(ILimsDbContext db, IMasterDataAuditService audit)
    { _db = db; _audit = audit; }

    public async Task<Result<int>> Handle(ReprintBarcodeCommand request, CancellationToken ct)
    {
        var exists = await _db.Samples.AnyAsync(s => s.SampleId == request.SampleId, ct);
        if (!exists) return Result<int>.Failure("NOT_FOUND", "Sample not found.");

        _db.BarcodePrintLogs.Add(new BarcodePrintLog
        {
            SampleId = request.SampleId,
            PrintType = "Reprint",
            PrintedBy = request.PrintedBy,
            PrintedAt = DateTimeOffset.UtcNow,
            Reason = request.Reason
        });
        await _db.SaveChangesAsync(ct);

        try { await _audit.LogAsync("Sample", request.SampleId, "BarcodeReprinted",
            null, new { PrintType = "Reprint", request.Reason }, request.PrintedBy); } catch { /* non-critical */ }

        return Result<int>.Success(request.SampleId);
    }
}
