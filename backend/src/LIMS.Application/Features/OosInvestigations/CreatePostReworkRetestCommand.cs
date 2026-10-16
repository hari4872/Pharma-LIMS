using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.OosInvestigations;

public record CreatePostReworkRetestCommand(int InvestigationId, string? Notes, string CreatedBy) : IRequest<Result<int>>;

public class CreatePostReworkRetestHandler : IRequestHandler<CreatePostReworkRetestCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IMasterDataAuditService _audit;

    public CreatePostReworkRetestHandler(ILimsDbContext db, IMasterDataAuditService audit)
    { _db = db; _audit = audit; }

    public async Task<Result<int>> Handle(CreatePostReworkRetestCommand cmd, CancellationToken ct)
    {
        var inv = await _db.OosInvestigations
            .Include(i => i.Execution)
            .Include(i => i.ReworkExecution)
            .FirstOrDefaultAsync(i => i.InvestigationId == cmd.InvestigationId, ct);

        if (inv is null) return Result<int>.Failure("NOT_FOUND", "Investigation not found.");
        if (inv.Status == OosStatus.Closed)
            return Result<int>.Failure("INVALID_STATE", "Investigation is already closed.");
        if (!inv.ReworkExecutionId.HasValue)
            return Result<int>.Failure("NO_REWORK", "Rework task must be created before post-rework retest.");
        if (inv.PostReworkRetestExecutionId.HasValue)
            return Result<int>.Failure("ALREADY_EXISTS", "A post-rework retest already exists for this investigation.");

        var original = inv.Execution;
        if (original is null)
            return Result<int>.Failure("DATA_ERROR", "Original execution not found.");

        var retest = new TestExecution
        {
            SampleId            = original.SampleId,
            ParameterId         = original.ParameterId,
            SpecTemplateItemId  = original.SpecTemplateItemId,
            FormTemplateId      = original.FormTemplateId,
            InstrumentId        = original.InstrumentId,
            AnalystId           = original.AnalystId,
            AssignedById        = original.AnalystId,
            SampleContainerId   = original.SampleContainerId,
            TaskType            = TaskType.Retest,
            RetestOfExecutionId = inv.ReworkExecutionId,
            OosInvestigationId  = inv.InvestigationId,
            PriorityScore       = original.PriorityScore,
            Status              = TestExecutionStatus.Assigned,
            AdHocReason         = cmd.Notes,
            CreatedBy           = cmd.CreatedBy,
            CreatedAt           = DateTimeOffset.UtcNow,
        };
        _db.TestExecutions.Add(retest);
        await _db.SaveChangesAsync(ct);

        inv.PostReworkRetestExecutionId = retest.ExecutionId;
        await _db.SaveChangesAsync(ct);

        try
        {
            await _audit.LogAsync("OosInvestigation", inv.InvestigationId, "PostReworkRetestCreated",
                null, new { PostReworkRetestExecutionId = retest.ExecutionId, cmd.Notes }, cmd.CreatedBy);
        }
        catch { }

        return Result<int>.Success(retest.ExecutionId);
    }
}
