using FluentValidation;
using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.Checkpoints;

public record CreateCheckpointCommand(
    string CheckpointCode, int LabId, string TriggerMode,
    string CheckpointType, string? TimeSlots, int? ShiftIntervalHrs,
    string CreatedBy) : IRequest<Result<int>>;

public class CreateCheckpointValidator : AbstractValidator<CreateCheckpointCommand>
{
    public CreateCheckpointValidator()
    {
        RuleFor(x => x.CheckpointCode).NotEmpty().MaximumLength(50);
        RuleFor(x => x.LabId).GreaterThan(0);
        RuleFor(x => x.TriggerMode).NotEmpty()
            .Must(m => new[] { "TimeBased", "OperatorScan", "ProcessLog", "DispatchEvent" }.Contains(m))
            .WithMessage("TriggerMode must be TimeBased, OperatorScan, ProcessLog, or DispatchEvent.");
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

        var checkpoint = new Checkpoint
        {
            CheckpointCode = request.CheckpointCode,
            LabId = request.LabId,
            TriggerMode = Enum.Parse<TriggerType>(request.TriggerMode),
            CheckpointType = request.CheckpointType,
            TimeSlots = request.TimeSlots,
            ShiftIntervalHrs = request.ShiftIntervalHrs
        };
        _db.Checkpoints.Add(checkpoint);
        await _db.SaveChangesAsync(ct);
        return Result<int>.Success(checkpoint.CheckpointId);
    }
}
