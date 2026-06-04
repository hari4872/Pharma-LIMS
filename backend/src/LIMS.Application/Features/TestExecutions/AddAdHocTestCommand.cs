using FluentValidation;
using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.TestExecutions;

public record AddAdHocTestCommand(
    int SampleId,
    int ParameterId,
    string Reason,
    string CreatedBy) : IRequest<Result<AdHocTestResult>>;

public record AdHocTestResult(
    int ExecutionId,
    string SampleNumber,
    string ParameterName,
    string Status);

public class AddAdHocTestValidator : AbstractValidator<AddAdHocTestCommand>
{
    public AddAdHocTestValidator()
    {
        RuleFor(x => x.SampleId).GreaterThan(0);
        RuleFor(x => x.ParameterId).GreaterThan(0);
        RuleFor(x => x.Reason).NotEmpty().MaximumLength(500).WithMessage("Reason is required (max 500 chars).");
    }
}

public class AddAdHocTestHandler : IRequestHandler<AddAdHocTestCommand, Result<AdHocTestResult>>
{
    private readonly ILimsDbContext _db;
    private readonly IMasterDataAuditService _audit;
    private readonly INotificationService _notifications;

    public AddAdHocTestHandler(ILimsDbContext db, IMasterDataAuditService audit, INotificationService notifications)
    { _db = db; _audit = audit; _notifications = notifications; }

    public async Task<Result<AdHocTestResult>> Handle(AddAdHocTestCommand cmd, CancellationToken ct)
    {
        var sample = await _db.Samples
            .Include(s => s.SampleTypeNav)
            .FirstOrDefaultAsync(s => s.SampleId == cmd.SampleId, ct);

        if (sample is null)
            return Result<AdHocTestResult>.Failure("NOT_FOUND", "Sample not found.");

        if (sample.Status == SampleStatus.Rejected ||
            sample.Status == SampleStatus.Released ||
            sample.Status == SampleStatus.PendingQAReview)
            return Result<AdHocTestResult>.Failure("INVALID_STATUS",
                $"Cannot add ad-hoc test to a sample in {sample.Status} status.");

        var param = await _db.TestMethodParameters
            .FirstOrDefaultAsync(p => p.ParameterId == cmd.ParameterId, ct);

        if (param is null)
            return Result<AdHocTestResult>.Failure("PARAM_NOT_FOUND", "Parameter not found.");

        var execution = new TestExecution
        {
            SampleId     = cmd.SampleId,
            ParameterId  = cmd.ParameterId,
            Status       = TestExecutionStatus.Assigned,
            IsAdHoc      = true,
            AdHocReason  = cmd.Reason,
            CreatedBy    = cmd.CreatedBy,
            CreatedAt    = DateTimeOffset.UtcNow,
        };

        _db.TestExecutions.Add(execution);
        await _db.SaveChangesAsync(ct);

        await _audit.LogAsync("TestExecution", execution.ExecutionId, "AdHocTestAdded",
            null,
            new { sample.SampleNumber, param.ParameterName, cmd.Reason },
            cmd.CreatedBy);

        await _notifications.PushToGroupAsync("LabManager", "AdHocTestRequested",
            new { execution.ExecutionId, sample.SampleNumber, param.ParameterName, cmd.Reason }, ct);

        return Result<AdHocTestResult>.Success(new AdHocTestResult(
            execution.ExecutionId, sample.SampleNumber, param.ParameterName, "Assigned"));
    }
}
