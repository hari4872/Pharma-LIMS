using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
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
    private readonly IMasterDataAuditService _audit;

    public CompleteReworkHandler(ILimsDbContext db, IMasterDataAuditService audit)
    { _db = db; _audit = audit; }

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

        // Document the physical rework details
        execution.AdHocReason = $"[{cmd.ReworkType}] Equipment: {cmd.EquipmentUsed} | {cmd.Description}" +
            (string.IsNullOrWhiteSpace(cmd.Notes) ? "" : $" | Notes: {cmd.Notes}");
        execution.Status = TestExecutionStatus.Completed;
        execution.CompletedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);

        // Auto-create Post-Rework Retest so analyst goes straight to Work Queue
        if (execution.OosInvestigationId.HasValue)
        {
            var inv = await _db.OosInvestigations
                .Include(i => i.Execution)
                .FirstOrDefaultAsync(i => i.InvestigationId == execution.OosInvestigationId.Value, ct);

            if (inv is not null && !inv.PostReworkRetestExecutionId.HasValue && inv.Status != OosStatus.Closed)
            {
                var original = inv.Execution;
                if (original is not null)
                {
                    var retest = new TestExecution
                    {
                        SampleId           = original.SampleId,
                        ParameterId        = original.ParameterId,
                        SpecTemplateItemId = original.SpecTemplateItemId,
                        FormTemplateId     = original.FormTemplateId,
                        InstrumentId       = original.InstrumentId,
                        AnalystId          = original.AnalystId,
                        AssignedById       = original.AnalystId,
                        SampleContainerId  = original.SampleContainerId,
                        TaskType           = TaskType.Retest,
                        RetestOfExecutionId = execution.ExecutionId,
                        OosInvestigationId = inv.InvestigationId,
                        PriorityScore      = original.PriorityScore,
                        Status             = TestExecutionStatus.Assigned,
                        CreatedBy          = cmd.UserId.ToString(),
                        CreatedAt          = DateTimeOffset.UtcNow,
                    };
                    _db.TestExecutions.Add(retest);
                    await _db.SaveChangesAsync(ct);

                    inv.PostReworkRetestExecutionId = retest.ExecutionId;
                    await _db.SaveChangesAsync(ct);

                    try
                    {
                        await _audit.LogAsync("OosInvestigation", inv.InvestigationId, "PostReworkRetestAutoCreated",
                            null, new { PostReworkRetestExecutionId = retest.ExecutionId }, cmd.UserId.ToString());
                    }
                    catch { }
                }
            }
        }

        return Result<int>.Success(execution.ExecutionId);
    }
}
