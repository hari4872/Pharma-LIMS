using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.TestExecutions;

public record CompleteReworkCommand(
    int ExecutionId,
    int UserId,
    string ReworkType,
    string EquipmentUsed,
    string Description,
    string? Notes,
    bool IsAdmin = false) : IRequest<Result<int>>;

public class CompleteReworkHandler : IRequestHandler<CompleteReworkCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IElectronicSignatureService _esig;

    public CompleteReworkHandler(ILimsDbContext db, IElectronicSignatureService esig)
    { _db = db; _esig = esig; }

    public async Task<Result<int>> Handle(CompleteReworkCommand cmd, CancellationToken ct)
    {
        var execution = await _db.TestExecutions
            .FirstOrDefaultAsync(e => e.ExecutionId == cmd.ExecutionId, ct);

        if (execution is null) return Result<int>.Failure("NOT_FOUND", "Execution not found.");
        if (execution.TaskType != TaskType.Rework)
            return Result<int>.Failure("INVALID_TYPE", "Only Rework executions can be completed this way.");
        if (!cmd.IsAdmin && execution.AnalystId != cmd.UserId)
            return Result<int>.Failure("FORBIDDEN", "Not your task.");
        if (execution.Status == TestExecutionStatus.Completed)
            return Result<int>.Failure("INVALID_STATE", "Rework is already completed.");

        execution.AdHocReason = $"[{cmd.ReworkType}] Equipment: {cmd.EquipmentUsed} | {cmd.Description}" +
            (string.IsNullOrWhiteSpace(cmd.Notes) ? "" : $" | Notes: {cmd.Notes}");
        execution.Status = TestExecutionStatus.Completed;
        execution.CompletedAt = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);
        return Result<int>.Success(execution.ExecutionId);
    }
}
