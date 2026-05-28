using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using FluentValidation;
using MediatR;

namespace LIMS.Application.Features.MasterData.UserTrainingRecords;

public record CreateUserTrainingRecordCommand(int UserId, int MethodId, DateOnly TrainingDate,
    DateOnly? ValidUntil, string RecordedBy) : IRequest<Result<int>>;

public class CreateUserTrainingRecordCommandValidator : AbstractValidator<CreateUserTrainingRecordCommand>
{
    public CreateUserTrainingRecordCommandValidator()
    {
        RuleFor(x => x.UserId).GreaterThan(0);
        RuleFor(x => x.MethodId).GreaterThan(0);
        When(x => x.ValidUntil.HasValue, () =>
            RuleFor(x => x.ValidUntil!.Value).GreaterThan(x => x.TrainingDate)
                .WithMessage("ValidUntil must be after TrainingDate."));
    }
}

public class CreateUserTrainingRecordCommandHandler : IRequestHandler<CreateUserTrainingRecordCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IMasterDataAuditService _audit;
    public CreateUserTrainingRecordCommandHandler(ILimsDbContext db, IMasterDataAuditService audit) { _db = db; _audit = audit; }

    public async Task<Result<int>> Handle(CreateUserTrainingRecordCommand request, CancellationToken ct)
    {
        var record = new UserTrainingRecord
        {
            UserId = request.UserId, MethodId = request.MethodId,
            TrainingDate = request.TrainingDate, ValidUntil = request.ValidUntil,
            RecordedBy = request.RecordedBy, CreatedAt = DateTimeOffset.UtcNow
        };
        _db.UserTrainingRecords.Add(record);
        await _db.SaveChangesAsync(ct);
        await _audit.LogAsync("UserTrainingRecord", record.TrainingId, "Created", null, record, request.RecordedBy);
        return Result<int>.Success(record.TrainingId);
    }
}
