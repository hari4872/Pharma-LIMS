using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.Samples;

public record DuplicateSampleCommand(int SourceSampleId, string CreatedBy) : IRequest<Result<RegisterSampleResult>>;

public class DuplicateSampleCommandHandler : IRequestHandler<DuplicateSampleCommand, Result<RegisterSampleResult>>
{
    private readonly ILimsDbContext _db;
    private readonly ISampleIdFormatService _sampleIdFormat;
    private readonly IMasterDataAuditService _audit;

    public DuplicateSampleCommandHandler(ILimsDbContext db, ISampleIdFormatService sampleIdFormat, IMasterDataAuditService audit)
    { _db = db; _sampleIdFormat = sampleIdFormat; _audit = audit; }

    public async Task<Result<RegisterSampleResult>> Handle(DuplicateSampleCommand request, CancellationToken ct)
    {
        var src = await _db.Samples
            .Include(s => s.SampleTypeNav)
            .FirstOrDefaultAsync(s => s.SampleId == request.SourceSampleId, ct);

        if (src is null)
            return Result<RegisterSampleResult>.Failure("NOT_FOUND", "Source sample not found.");

        if (src.SampleTypeNav is null)
            return Result<RegisterSampleResult>.Failure("DATA_ERROR", "Sample type data could not be loaded.");

        var now = DateTimeOffset.UtcNow;
        var sampleNumber = await _sampleIdFormat.GenerateAsync(src.LabId, src.MaterialId, src.SampleTypeNav.TypeCode, src.LotNumber, ct);

        var duplicate = new Sample
        {
            SampleNumber     = sampleNumber,
            LabId            = src.LabId,
            MaterialId       = src.MaterialId,
            LotNumber        = src.LotNumber,
            MfgDate          = src.MfgDate,
            ExpDate          = src.ExpDate,
            SampleTypeId     = src.SampleTypeId,
            AnalystId        = src.AnalystId,
            FormTemplateId   = src.FormTemplateId,
            SpecTemplateId   = src.SpecTemplateId,
            ReceivedTemp     = src.ReceivedTemp,
            SampleCondition  = src.SampleCondition,
            IsRush           = src.IsRush,
            ExternalBatchId  = src.ExternalBatchId,
            SampleLabel      = src.SampleLabel,
            TankSourceId     = src.TankSourceId,
            Status           = SampleStatus.Registered,
            BarcodePrinted   = true,
            BarcodePrintedAt = now,
            CreatedBy        = request.CreatedBy,
            CreatedAt        = now,
        };

        _db.Samples.Add(duplicate);
        _db.BarcodePrintLogs.Add(new BarcodePrintLog
        {
            Sample    = duplicate,
            PrintType = "AutoOnRegistration",
            PrintedBy = request.CreatedBy,
            PrintedAt = now,
        });

        await _db.SaveChangesAsync(ct);

        try { await _audit.LogAsync("Sample", duplicate.SampleId, "Duplicated",
            null, new { duplicate.SampleNumber, SourceSampleId = request.SourceSampleId, src.LotNumber },
            request.CreatedBy); } catch { /* non-critical */ }

        return Result<RegisterSampleResult>.Success(new RegisterSampleResult(
            duplicate.SampleId, duplicate.SampleNumber,
            "PendingSignature", "Duplicated from sample " + src.SampleNumber, 0));
    }
}
