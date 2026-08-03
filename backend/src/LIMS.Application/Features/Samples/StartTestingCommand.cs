using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.Samples;

// Called from wizard Step 5 after barcode is printed — transitions sample to InTesting
public record StartTestingCommand(int SampleId) : IRequest<Result<bool>>;

public class StartTestingHandler : IRequestHandler<StartTestingCommand, Result<bool>>
{
    private readonly ILimsDbContext _db;
    private readonly IMasterDataAuditService _audit;
    public StartTestingHandler(ILimsDbContext db, IMasterDataAuditService audit) { _db = db; _audit = audit; }

    public async Task<Result<bool>> Handle(StartTestingCommand cmd, CancellationToken ct)
    {
        var sample = await _db.Samples.FirstOrDefaultAsync(s => s.SampleId == cmd.SampleId, ct);
        if (sample is null) return Result<bool>.Failure("NOT_FOUND", "Sample not found.");

        if (sample.Status == SampleStatus.InTesting)
            return Result<bool>.Success(true); // already there — idempotent

        if (sample.Status != SampleStatus.PendingTesting && sample.Status != SampleStatus.Registered)
            return Result<bool>.Failure("INVALID_STATE", $"Sample is '{sample.Status}' — must be PendingTesting to start testing.");

        sample.Status = SampleStatus.InTesting;
        await _db.SaveChangesAsync(ct);
        try { await _audit.LogAsync("Sample", cmd.SampleId, "StartTesting", null, new { Status = "InTesting", Trigger = "BarcodePrinted" }, "System"); } catch { }
        return Result<bool>.Success(true);
    }
}
