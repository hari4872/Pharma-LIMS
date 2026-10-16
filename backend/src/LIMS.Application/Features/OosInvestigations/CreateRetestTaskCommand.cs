using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.OosInvestigations;

public record CreateRetestTaskCommand(
    int InvestigationId,
    string? Notes,
    string CreatedBy) : IRequest<Result<int>>;

public class CreateRetestTaskHandler : IRequestHandler<CreateRetestTaskCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IMasterDataAuditService _audit;

    public CreateRetestTaskHandler(ILimsDbContext db, IMasterDataAuditService audit)
    { _db = db; _audit = audit; }

    public async Task<Result<int>> Handle(CreateRetestTaskCommand cmd, CancellationToken ct)
    {
        var inv = await _db.OosInvestigations
            .Include(i => i.Execution)
            .FirstOrDefaultAsync(i => i.InvestigationId == cmd.InvestigationId, ct);

        if (inv is null) return Result<int>.Failure("NOT_FOUND", "Investigation not found.");
        if (inv.Status == OosStatus.Closed)
            return Result<int>.Failure("INVALID_STATE", "Cannot create retest — investigation is already closed.");
        if (inv.RetestExecutionId.HasValue)
            return Result<int>.Failure("ALREADY_EXISTS", "A retest task already exists for this investigation.");

        var original = inv.Execution;
        if (original is null)
            return Result<int>.Failure("DATA_ERROR", "Original execution not found.");

        // Create retest execution — same sample/parameter/spec, same analyst, RETEST type
        var retest = new TestExecution
        {
            SampleId           = original.SampleId,
            ParameterId        = original.ParameterId,
            SpecTemplateItemId = original.SpecTemplateItemId,
            FormTemplateId     = original.FormTemplateId,
            InstrumentId       = original.InstrumentId,
            AnalystId          = original.AnalystId,
            AssignedById       = original.AnalystId,         // same analyst pre-assigned
            SampleContainerId  = original.SampleContainerId,
            TaskType           = TaskType.Retest,
            RetestOfExecutionId = original.ExecutionId,
            OosInvestigationId = inv.InvestigationId,
            PriorityScore      = original.PriorityScore,
            Status             = TestExecutionStatus.Assigned,
            AdHocReason        = cmd.Notes,
            CreatedBy          = cmd.CreatedBy,
            CreatedAt          = DateTimeOffset.UtcNow,
        };
        _db.TestExecutions.Add(retest);

        // Link back to investigation — SaveChanges will populate retest.ExecutionId
        await _db.SaveChangesAsync(ct);

        inv.RetestExecutionId = retest.ExecutionId;
        await _db.SaveChangesAsync(ct);

        try
        {
            await _audit.LogAsync("OosInvestigation", inv.InvestigationId, "RetestCreated",
                null, new { RetestExecutionId = retest.ExecutionId, cmd.Notes }, cmd.CreatedBy);
        }
        catch { /* non-critical */ }

        return Result<int>.Success(retest.ExecutionId);
    }
}
