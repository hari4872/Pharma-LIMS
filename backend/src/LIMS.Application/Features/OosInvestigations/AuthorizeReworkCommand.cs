using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.OosInvestigations;

public record AuthorizeReworkCommand(int InvestigationId, string? Notes, string CreatedBy) : IRequest<Result<int>>;

public class AuthorizeReworkHandler : IRequestHandler<AuthorizeReworkCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IMasterDataAuditService _audit;

    public AuthorizeReworkHandler(ILimsDbContext db, IMasterDataAuditService audit)
    { _db = db; _audit = audit; }

    public async Task<Result<int>> Handle(AuthorizeReworkCommand cmd, CancellationToken ct)
    {
        var inv = await _db.OosInvestigations
            .Include(i => i.Execution)
            .FirstOrDefaultAsync(i => i.InvestigationId == cmd.InvestigationId, ct);

        if (inv is null) return Result<int>.Failure("NOT_FOUND", "Investigation not found.");
        if (inv.Status == OosStatus.Closed)
            return Result<int>.Failure("INVALID_STATE", "Investigation is already closed.");
        if (inv.Phase != OosPhase.Phase2)
            return Result<int>.Failure("INVALID_PHASE", "Rework can only be authorized after Phase 2 escalation.");
        if (inv.ReworkExecutionId.HasValue)
            return Result<int>.Failure("ALREADY_EXISTS", "A rework task already exists for this investigation.");

        var original = inv.Execution;
        if (original is null)
            return Result<int>.Failure("DATA_ERROR", "Original execution not found.");

        var rework = new TestExecution
        {
            SampleId            = original.SampleId,
            ParameterId         = original.ParameterId,
            SpecTemplateItemId  = original.SpecTemplateItemId,
            FormTemplateId      = original.FormTemplateId,
            InstrumentId        = original.InstrumentId,
            AnalystId           = original.AnalystId,
            AssignedById        = original.AnalystId,
            SampleContainerId   = original.SampleContainerId,
            TaskType            = TaskType.Rework,
            RetestOfExecutionId = original.ExecutionId,
            OosInvestigationId  = inv.InvestigationId,
            PriorityScore       = original.PriorityScore,
            Status              = TestExecutionStatus.Assigned,
            AdHocReason         = cmd.Notes,
            CreatedBy           = cmd.CreatedBy,
            CreatedAt           = DateTimeOffset.UtcNow,
        };
        _db.TestExecutions.Add(rework);
        await _db.SaveChangesAsync(ct);

        inv.ReworkExecutionId = rework.ExecutionId;
        await _db.SaveChangesAsync(ct);

        try
        {
            await _audit.LogAsync("OosInvestigation", inv.InvestigationId, "ReworkAuthorized",
                null, new { ReworkExecutionId = rework.ExecutionId, cmd.Notes }, cmd.CreatedBy);
        }
        catch { }

        return Result<int>.Success(rework.ExecutionId);
    }
}
