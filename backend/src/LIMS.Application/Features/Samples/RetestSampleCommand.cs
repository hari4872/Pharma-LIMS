using FluentValidation;
using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.Samples;

public record RetestSampleCommand(int OriginalSampleId, string RetestReason, string CreatedBy) : IRequest<Result<RegisterSampleResult>>;

public class RetestSampleValidator : AbstractValidator<RetestSampleCommand>
{
    public RetestSampleValidator()
    {
        RuleFor(x => x.OriginalSampleId).GreaterThan(0);
        RuleFor(x => x.RetestReason).NotEmpty().MaximumLength(500).WithMessage("Retest reason is required (max 500 chars).");
    }
}

public class RetestSampleCommandHandler : IRequestHandler<RetestSampleCommand, Result<RegisterSampleResult>>
{
    private readonly ILimsDbContext _db;
    private readonly ISampleIdFormatService _sampleIdFormat;
    private readonly IMasterDataAuditService _audit;
    private readonly INotificationService _notifications;

    public RetestSampleCommandHandler(ILimsDbContext db, ISampleIdFormatService sampleIdFormat,
        IMasterDataAuditService audit, INotificationService notifications)
    { _db = db; _sampleIdFormat = sampleIdFormat; _audit = audit; _notifications = notifications; }

    public async Task<Result<RegisterSampleResult>> Handle(RetestSampleCommand request, CancellationToken ct)
    {
        var src = await _db.Samples
            .Include(s => s.SampleTypeNav)
            .FirstOrDefaultAsync(s => s.SampleId == request.OriginalSampleId, ct);

        if (src is null)
            return Result<RegisterSampleResult>.Failure("NOT_FOUND", "Original sample not found.");

        if (src.Status != SampleStatus.Released && src.Status != SampleStatus.Rejected)
            return Result<RegisterSampleResult>.Failure("INVALID_STATUS",
                $"Retest only allowed on Released or Rejected samples. Current status: {src.Status}.");

        var now = DateTimeOffset.UtcNow;
        var sampleNumber = await _sampleIdFormat.GenerateAsync(src.LabId, src.MaterialId, src.SampleTypeNav.TypeCode, src.LotNumber, ct);

        var retest = new Sample
        {
            SampleNumber      = sampleNumber,
            LabId             = src.LabId,
            MaterialId        = src.MaterialId,
            LotNumber         = src.LotNumber,
            MfgDate           = src.MfgDate,
            ExpDate           = src.ExpDate,
            SampleTypeId      = src.SampleTypeId,
            AnalystId         = src.AnalystId,
            FormTemplateId    = src.FormTemplateId,
            SpecTemplateId    = src.SpecTemplateId,
            ReceivedTemp      = src.ReceivedTemp,
            SampleCondition   = src.SampleCondition,
            IsRush            = src.IsRush,
            ExternalBatchId   = src.ExternalBatchId,
            RetestOfSampleId  = request.OriginalSampleId,
            RetestReason      = request.RetestReason,
            Status            = SampleStatus.Registered,
            BarcodePrinted    = true,
            BarcodePrintedAt  = now,
            CreatedBy         = request.CreatedBy,
            CreatedAt         = now,
        };

        _db.Samples.Add(retest);
        _db.BarcodePrintLogs.Add(new BarcodePrintLog
        {
            Sample    = retest,
            PrintType = "AutoOnRegistration",
            PrintedBy = request.CreatedBy,
            PrintedAt = now,
        });

        await _db.SaveChangesAsync(ct);

        await _audit.LogAsync("Sample", retest.SampleId, "Retest",
            null,
            new { retest.SampleNumber, OriginalSampleId = request.OriginalSampleId, OriginalSampleNumber = src.SampleNumber, request.RetestReason },
            request.CreatedBy);

        await _notifications.PushToGroupAsync("LabManager", "RetestRegistered",
            new { retest.SampleId, retest.SampleNumber, OriginalSampleNumber = src.SampleNumber, request.RetestReason }, ct);

        return Result<RegisterSampleResult>.Success(new RegisterSampleResult(
            retest.SampleId, retest.SampleNumber,
            "PendingSignature", $"Retest of {src.SampleNumber}: {request.RetestReason}", 0));
    }
}
