using FluentValidation;
using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.Samples;

// FR-01: unified command — both manual registration and Checkpoint auto-trigger use this
public record RegisterSampleCommand(
    int LabId, int MaterialId, string LotNumber,
    DateOnly MfgDate, DateOnly ExpDate, int SampleTypeId,   // Gap 2 fix: FK to SampleType master (was free-text string)
    int AnalystId, string CreatedBy) : IRequest<Result<int>>;

public class RegisterSampleValidator : AbstractValidator<RegisterSampleCommand>
{
    public RegisterSampleValidator()
    {
        RuleFor(x => x.LabId).GreaterThan(0);
        RuleFor(x => x.MaterialId).GreaterThan(0);
        RuleFor(x => x.LotNumber).NotEmpty().MaximumLength(100);
        RuleFor(x => x.SampleTypeId).GreaterThan(0).WithMessage("SampleTypeId is required — select from Master Data.");
        RuleFor(x => x.AnalystId).GreaterThan(0);
        RuleFor(x => x.ExpDate).GreaterThan(x => x.MfgDate)
            .WithMessage("Expiry date must be after manufacturing date.");
    }
}

public class RegisterSampleCommandHandler : IRequestHandler<RegisterSampleCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly ISampleIdFormatService _sampleIdFormat;
    private readonly IFormTemplateSelectorService _templateSelector;
    private readonly ISampleValidatorService _validator;
    private readonly IMasterDataAuditService _audit;
    private readonly INotificationService _notifications;

    public RegisterSampleCommandHandler(
        ILimsDbContext db, ISampleIdFormatService sampleIdFormat,
        IFormTemplateSelectorService templateSelector, ISampleValidatorService validator,
        IMasterDataAuditService audit, INotificationService notifications)
    {
        _db = db; _sampleIdFormat = sampleIdFormat; _templateSelector = templateSelector;
        _validator = validator; _audit = audit; _notifications = notifications;
    }

    public async Task<Result<int>> Handle(RegisterSampleCommand request, CancellationToken ct)
    {
        // Step 2a: validate material exists and is active
        var material = await _db.Materials.FirstOrDefaultAsync(m => m.MaterialId == request.MaterialId && m.IsActive, ct);
        if (material is null) return Result<int>.Failure("MATERIAL_NOT_FOUND", "Material not found or inactive.");

        // Step 2b: Gap 2 fix — validate SampleType FK exists and is active
        var sampleType = await _db.SampleTypes.FirstOrDefaultAsync(t => t.SampleTypeId == request.SampleTypeId && t.IsActive, ct);
        if (sampleType is null) return Result<int>.Failure("SAMPLE_TYPE_NOT_FOUND", "Sample type not found or inactive — configure in Master Data.");

        // Step 3: server-generated Sample ID (ALCOA+ Original — FR-02, FR-16)
        var sampleNumber = await _sampleIdFormat.GenerateAsync(request.LabId, request.MaterialId, sampleType.TypeCode, request.LotNumber, ct);

        // Step 4: barcode auto-printed before validation gate (FR-14)
        var sample = new Sample
        {
            SampleNumber = sampleNumber,
            LabId = request.LabId,
            MaterialId = request.MaterialId,
            LotNumber = request.LotNumber,
            MfgDate = request.MfgDate,
            ExpDate = request.ExpDate,
            SampleTypeId = request.SampleTypeId,            // Gap 2 fix: FK instead of free-text
            AnalystId = request.AnalystId,
            Status = SampleStatus.Registered,
            BarcodePrinted = true,
            BarcodePrintedAt = DateTimeOffset.UtcNow,
            CreatedBy = request.CreatedBy,
            CreatedAt = DateTimeOffset.UtcNow
        };

        // Step 5: 5 GMP pre-checks via SampleValidatorService (Contract 1 — FR-03 to FR-08)
        var validation = await _validator.ValidateAsync(request.LabId, request.MaterialId, request.AnalystId, request.ExpDate, ct);
        if (!validation.IsValid)
            return Result<int>.Failure("VALIDATION_FAILED", string.Join("; ", validation.Failures));

        // Step 6: Form Template auto-selected server-side (FR-17)
        sample.FormTemplateId = await _templateSelector.SelectAsync(request.LabId, request.MaterialId, ct);

        // TAT due date from DB config (FR-10, Contract 2)
        var tatConfig = await _db.LabConfigs
            .FirstOrDefaultAsync(c => c.LabId == request.LabId && c.ConfigKey == "sample_tat_hours", ct);
        if (tatConfig is not null && int.TryParse(tatConfig.ConfigValue, out var tatHours))
            sample.DueDate = DateTimeOffset.UtcNow.AddHours(tatHours);

        _db.Samples.Add(sample);

        // Barcode print log — INSERT-only (21 CFR 211.170)
        _db.BarcodePrintLogs.Add(new BarcodePrintLog
        {
            Sample = sample,
            PrintType = "AutoOnRegistration",
            PrintedBy = request.CreatedBy,
            PrintedAt = sample.BarcodePrintedAt!.Value
        });

        await _db.SaveChangesAsync(ct);

        await _audit.LogAsync("Sample", sample.SampleId, "Registered", null,
            new { sample.SampleNumber, sample.LotNumber, SampleType = sampleType.TypeCode, Status = "Registered" },
            request.CreatedBy);

        // Contract 2: push via SignalR — no polling (FR-11)
        await _notifications.PushToGroupAsync("LabManager", "SampleRegistered",
            new { sample.SampleId, sample.SampleNumber, sample.LotNumber, material.MaterialName }, ct);

        return Result<int>.Success(sample.SampleId);
    }
}
