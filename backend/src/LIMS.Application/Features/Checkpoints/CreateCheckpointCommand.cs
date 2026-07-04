using FluentValidation;
using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.Checkpoints;

public record ParameterLimitsInput(
    int ParameterId,
    decimal? AlertMin, decimal? AlertMax,
    decimal? ActionMin, decimal? ActionMax);

public record CreateCheckpointCommand(
    string CheckpointCode, int LabId, string TriggerMode,
    string CheckpointType, string? TimeSlots, int? ShiftIntervalHrs,
    int? FormTemplateId,
    List<int>? ParameterIds,                                 // legacy — plain IDs, no limits
    string CreatedBy,
    List<ParameterLimitsInput>? Parameters = null) : IRequest<Result<int>>;   // preferred — IDs + two-tier limits

public class CreateCheckpointValidator : AbstractValidator<CreateCheckpointCommand>
{
    public CreateCheckpointValidator()
    {
        RuleFor(x => x.CheckpointCode).NotEmpty().MaximumLength(50);
        RuleFor(x => x.LabId).GreaterThan(0);
        RuleFor(x => x.TriggerMode).NotEmpty()
            .Must(m => new[] { "TimeBased", "OperatorScan", "ProcessLog", "DispatchEvent" }.Contains(m))
            .WithMessage("TriggerMode must be TimeBased, OperatorScan, ProcessLog, or DispatchEvent.");
        // FormTemplate required for all modes except DispatchEvent (DispatchEventService selects it dynamically)
        RuleFor(x => x.FormTemplateId)
            .GreaterThan(0).WithMessage("FormTemplateId is required for this trigger mode.")
            .When(x => x.TriggerMode != "DispatchEvent");
    }
}

public class CreateCheckpointCommandHandler : IRequestHandler<CreateCheckpointCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    public CreateCheckpointCommandHandler(ILimsDbContext db) => _db = db;

    public async Task<Result<int>> Handle(CreateCheckpointCommand request, CancellationToken ct)
    {
        var duplicate = await _db.Checkpoints.AnyAsync(c => c.CheckpointCode == request.CheckpointCode, ct);
        if (duplicate) return Result<int>.Failure("DUPLICATE", $"Checkpoint code '{request.CheckpointCode}' already exists.");

        // Validate FormTemplate exists when provided
        if (request.FormTemplateId.HasValue)
        {
            var ftExists = await _db.FormTemplates.AnyAsync(f => f.FormTemplateId == request.FormTemplateId.Value && f.IsActive, ct);
            if (!ftExists)
                return Result<int>.Failure("FORM_TEMPLATE_NOT_FOUND", $"FormTemplate {request.FormTemplateId} not found or inactive.");
        }

        var checkpoint = new Checkpoint
        {
            CheckpointCode = request.CheckpointCode,
            LabId = request.LabId,
            TriggerMode = Enum.Parse<TriggerType>(request.TriggerMode),
            CheckpointType = request.CheckpointType,
            TimeSlots = request.TimeSlots,
            ShiftIntervalHrs = request.ShiftIntervalHrs,
            FormTemplateId = request.FormTemplateId
        };
        _db.Checkpoints.Add(checkpoint);

        // Prefer Parameters (with limits) over plain ParameterIds
        if (request.Parameters is { Count: > 0 })
        {
            foreach (var p in request.Parameters.DistinctBy(x => x.ParameterId))
            {
                var paramExists = await _db.TestMethodParameters.AnyAsync(x => x.ParameterId == p.ParameterId, ct);
                if (paramExists)
                    _db.CheckpointParameters.Add(new CheckpointParameter
                    {
                        Checkpoint  = checkpoint,
                        ParameterId = p.ParameterId,
                        AlertMin    = p.AlertMin,  AlertMax  = p.AlertMax,
                        ActionMin   = p.ActionMin, ActionMax = p.ActionMax,
                    });
            }
        }
        else if (request.ParameterIds is { Count: > 0 })
        {
            foreach (var parameterId in request.ParameterIds.Distinct())
            {
                var paramExists = await _db.TestMethodParameters.AnyAsync(p => p.ParameterId == parameterId, ct);
                if (paramExists)
                    _db.CheckpointParameters.Add(new CheckpointParameter
                    {
                        Checkpoint  = checkpoint,
                        ParameterId = parameterId
                    });
            }
        }

        await _db.SaveChangesAsync(ct);
        return Result<int>.Success(checkpoint.CheckpointId);
    }
}
