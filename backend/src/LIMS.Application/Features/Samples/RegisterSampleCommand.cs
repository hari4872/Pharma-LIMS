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
    DateOnly MfgDate, DateOnly ExpDate, int SampleTypeId,
    int AnalystId, string CreatedBy,
    // Phase A: receipt fields
    decimal? ReceivedTemp     = null,
    string?  SampleCondition  = null,      // "OK" | "Damaged" | "Compromised"
    bool     IsRush           = false,
    string?  ExternalBatchId  = null,
    string?  SampleLabel      = null,      // physical label as written on container
    string?  TankSourceId     = null,      // source tank or vessel identifier
    // Phase A: spec engine override — null = auto-match, set = manual pick
    int?     OverrideSpecTemplateId = null,
    List<int>? CheckpointIds  = null) : IRequest<Result<RegisterSampleResult>>;

// Returns sample ID + spec match outcome — spec engine runs after SRF sign (SignSRFCommand)
public record RegisterSampleResult(
    int    SampleId,
    string SampleNumber,
    string SpecOutcome,         // "PendingSignature" at registration; spec runs after SRF sign
    string SpecMessage,
    int    TestsAutoCreated);

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
        RuleFor(x => x.SampleCondition)
            .Must(v => v == null || new[] { "OK", "Damaged", "Compromised" }.Contains(v))
            .WithMessage("SampleCondition must be OK, Damaged, or Compromised.");
        RuleFor(x => x.ReceivedTemp)
            .InclusiveBetween(-196m, 200m)
            .When(x => x.ReceivedTemp.HasValue)
            .WithMessage("Received temperature must be between -196°C and 200°C.");
        RuleFor(x => x.ExternalBatchId).MaximumLength(100).When(x => x.ExternalBatchId != null);
        RuleFor(x => x.SampleLabel).MaximumLength(200).When(x => x.SampleLabel != null);
        RuleFor(x => x.TankSourceId).MaximumLength(100).When(x => x.TankSourceId != null);
    }
}

public class RegisterSampleCommandHandler : IRequestHandler<RegisterSampleCommand, Result<RegisterSampleResult>>
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

    public async Task<Result<RegisterSampleResult>> Handle(RegisterSampleCommand request, CancellationToken ct)
    {
        // Step 1: validate material
        var material = await _db.Materials.FirstOrDefaultAsync(m => m.MaterialId == request.MaterialId && m.IsActive, ct);
        if (material is null) return Result<RegisterSampleResult>.Failure("MATERIAL_NOT_FOUND", "Material not found or inactive.");

        // Step 2: validate SampleType
        var sampleType = await _db.SampleTypes.FirstOrDefaultAsync(t => t.SampleTypeId == request.SampleTypeId && t.IsActive, ct);
        if (sampleType is null) return Result<RegisterSampleResult>.Failure("SAMPLE_TYPE_NOT_FOUND", "Sample type not found or inactive — configure in Master Data.");

        // Step 3: GMP pre-checks
        var validation = await _validator.ValidateAsync(request.LabId, request.MaterialId, request.AnalystId, request.ExpDate, ct);
        if (!validation.IsValid)
            return Result<RegisterSampleResult>.Failure("VALIDATION_FAILED", string.Join("; ", validation.Failures));

        // Step 4: server-generated Sample ID (ALCOA+ Original)
        var sampleNumber = await _sampleIdFormat.GenerateAsync(request.LabId, request.MaterialId, sampleType.TypeCode, request.LotNumber, ct);
        var receivedAt   = DateTimeOffset.UtcNow;

        // Step 5: build sample entity with Phase A receipt fields
        var sample = new Sample
        {
            SampleNumber     = sampleNumber,
            LabId            = request.LabId,
            MaterialId       = request.MaterialId,
            LotNumber        = request.LotNumber,
            MfgDate          = request.MfgDate,
            ExpDate          = request.ExpDate,
            SampleTypeId     = request.SampleTypeId,
            AnalystId        = request.AnalystId,
            Status           = SampleStatus.Registered,
            BarcodePrinted   = true,
            BarcodePrintedAt = receivedAt,
            // Phase A receipt fields
            ReceivedTemp     = request.ReceivedTemp,
            SampleCondition  = request.SampleCondition,   // stored as text; validator ensures "OK"|"Damaged"|"Compromised"
            IsRush           = request.IsRush,
            ExternalBatchId  = request.ExternalBatchId,
            SampleLabel      = request.SampleLabel,
            TankSourceId     = request.TankSourceId,
            CreatedBy        = request.CreatedBy,
            CreatedAt        = receivedAt,
        };

        // Step 6: Form Template (legacy field — still populated for backward compat)
        sample.FormTemplateId = await _templateSelector.SelectAsync(request.LabId, request.MaterialId, ct);

        // Step 7: fallback TAT (used only if spec engine finds no template)
        var tatConfig = await _db.LabConfigs
            .FirstOrDefaultAsync(c => c.LabId == request.LabId && c.ConfigKey == "sample_tat_hours", ct);
        if (tatConfig is not null && int.TryParse(tatConfig.ConfigValue, out var tatHours))
            sample.DueDate = receivedAt.AddHours(tatHours);

        _db.Samples.Add(sample);

        // Barcode print log — INSERT-only (21 CFR 211.170)
        _db.BarcodePrintLogs.Add(new BarcodePrintLog
        {
            Sample    = sample,
            PrintType = "AutoOnRegistration",
            PrintedBy = request.CreatedBy,
            PrintedAt = receivedAt,
        });

        // Step 8: Checkpoint links — added before save so EF Core resolves SampleId in one commit
        if (request.CheckpointIds is { Count: > 0 })
        {
            foreach (var cpId in request.CheckpointIds.Distinct())
            {
                if (await _db.Checkpoints.AnyAsync(c => c.CheckpointId == cpId && c.IsActive, ct))
                    _db.SampleCheckpoints.Add(new SampleCheckpoint { Sample = sample, CheckpointId = cpId });
            }
        }

        await _db.SaveChangesAsync(ct);

        // ── Step 9: Audit + notification ─────────────────────────────────
        // Spec engine runs in SignSRFCommand — tests created only after SRF is signed (21 CFR GMP)
        await _audit.LogAsync("Sample", sample.SampleId, "Registered", null,
            new { sample.SampleNumber, sample.LotNumber, SampleType = sampleType.TypeCode,
                  Status = "Registered",
                  FormTemplateId = sample.FormTemplateId,
                  FormTemplateSelectionMethod = sample.FormTemplateId.HasValue ? "AutoMatch" : "NoTemplateFound",
                  SpecTemplateId = sample.SpecTemplateId,
                  SpecAssignmentReason = sample.SpecAssignmentReason?.ToString() ?? "Pending" },
            request.CreatedBy);

        await _notifications.PushToGroupAsync("LabManager", "SampleRegistered",
            new { sample.SampleId, sample.SampleNumber, sample.LotNumber,
                  material.MaterialName }, ct);

        return Result<RegisterSampleResult>.Success(new RegisterSampleResult(
            sample.SampleId, sample.SampleNumber,
            "PendingSignature",
            "Sign the SRF to assign tests automatically.",
            0));
    }
}
