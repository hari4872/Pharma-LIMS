using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.TestExecutions;

// Lab Manager assigns a sample to an analyst before analyst opens Work Queue (WAP FR-13)
public record AssignWorkQueueItemCommand(
    int SampleId, int AnalystId, int? InstrumentId,
    int AssignedById, int? PriorityScore, int? ContainerId = null,
    int[]? SpecTemplateItemIds = null) : IRequest<Result<int>>;

public class AssignWorkQueueItemHandler : IRequestHandler<AssignWorkQueueItemCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IMasterDataAuditService _audit;
    public AssignWorkQueueItemHandler(ILimsDbContext db, IMasterDataAuditService audit) { _db = db; _audit = audit; }

    public async Task<Result<int>> Handle(AssignWorkQueueItemCommand cmd, CancellationToken ct)
    {
        var sample = await _db.Samples.FirstOrDefaultAsync(s => s.SampleId == cmd.SampleId, ct);
        if (sample is null) return Result<int>.Failure("NOT_FOUND", "Sample not found.");
        if (sample.Status != SampleStatus.PendingTesting && sample.Status != SampleStatus.Registered && sample.Status != SampleStatus.InTesting)
            return Result<int>.Failure("INVALID_STATE", $"Sample status is '{sample.Status}' — must be PendingTesting, Registered, or InTesting.");

        var analyst = await _db.Users.FirstOrDefaultAsync(u => u.UserId == cmd.AnalystId && u.IsActive, ct);
        if (analyst is null) return Result<int>.Failure("NOT_FOUND", "Analyst not found or inactive.");

        // WAP FR-14: training check — hard block if expired
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var trained = await _db.UserTrainingRecords.AnyAsync(
            t => t.UserId == cmd.AnalystId && t.ValidUntil >= today, ct);
        if (!trained)
            return Result<int>.Failure("TRAINING_EXPIRED", "Analyst training expired — WAP assignment blocked. (21 CFR 11.10(i))");

        // Instrument is optional at assignment — analyst selects per-parameter during test execution
        Instrument? instrument = null;
        if (cmd.InstrumentId.HasValue)
        {
            instrument = await _db.Instruments.FirstOrDefaultAsync(i => i.InstrumentId == cmd.InstrumentId && i.IsActive, ct);
            if (instrument is null) return Result<int>.Failure("NOT_FOUND", "Instrument not found or inactive.");
        }

        // Validate container if provided — must belong to this sample and be Available
        SampleContainer? container = null;
        if (cmd.ContainerId.HasValue)
        {
            container = await _db.SampleContainers
                .FirstOrDefaultAsync(c => c.SampleContainerId == cmd.ContainerId.Value, ct);
            if (container is null)
                return Result<int>.Failure("NOT_FOUND", "Container not found.");
            if (container.SampleId != cmd.SampleId)
                return Result<int>.Failure("INVALID_STATE", "Container does not belong to this sample.");
            if (container.Status != LIMS.Domain.Enums.ContainerStatus.Available)
                return Result<int>.Failure("INVALID_STATE", $"Container is {container.Status} — only Available containers can be assigned.");
        }

        // Re-use executions the spec engine created at registration.
        // When SpecTemplateItemIds is provided (container split), only update the targeted executions
        // so each container gets its own analyst. When null, update all (single-container / no-split path).
        var executions = await _db.TestExecutions
            .Where(e => e.SampleId == cmd.SampleId
                && (e.Status == TestExecutionStatus.Assigned || e.Status == TestExecutionStatus.InProgress)
                && (cmd.SpecTemplateItemIds == null
                    || cmd.SpecTemplateItemIds.Contains(e.SpecTemplateItemId ?? 0)))
            .ToListAsync(ct);

        if (executions.Count > 0)
        {
            foreach (var exec in executions)
            {
                exec.AnalystId     = cmd.AnalystId;
                if (cmd.InstrumentId.HasValue) exec.InstrumentId = cmd.InstrumentId;
                exec.AssignedById  = cmd.AssignedById;
                exec.PriorityScore = cmd.PriorityScore ?? exec.PriorityScore;
                exec.Status        = TestExecutionStatus.Assigned;
                if (cmd.ContainerId.HasValue) exec.SampleContainerId = cmd.ContainerId;
            }
        }
        else if (cmd.SpecTemplateItemIds != null)
        {
            // Specific items requested but none found — already assigned to another container. Skip.
        }
        else
        {
            // No spec-engine executions exist. If the sample has a spec template,
            // create one execution per spec item so test names are populated.
            var createdFromSpec = false;
            if (sample.SpecTemplateId.HasValue)
            {
                var template = await _db.SpecificationTemplates
                    .Include(t => t.Items)
                    .FirstOrDefaultAsync(t => t.SpecTemplateId == sample.SpecTemplateId.Value, ct);

                if (template is not null && template.Items.Count > 0)
                {
                    foreach (var item in template.Items.OrderBy(i => i.SortOrder))
                    {
                        var exec = new TestExecution
                        {
                            SampleId          = cmd.SampleId,
                            SpecTemplateItemId = item.SpecTemplateItemId,
                            ParameterId       = item.ParameterId,
                            InstrumentId      = cmd.InstrumentId,
                            AnalystId         = cmd.AnalystId,
                            AssignedById      = cmd.AssignedById,
                            FormTemplateId    = sample.FormTemplateId,
                            PriorityScore     = cmd.PriorityScore ?? item.SortOrder,
                            SampleContainerId = cmd.ContainerId,
                            Status            = TestExecutionStatus.Assigned,
                            CreatedBy         = analyst.FullName,
                            CreatedAt         = DateTimeOffset.UtcNow
                        };
                        _db.TestExecutions.Add(exec);
                        executions.Add(exec);
                    }
                    createdFromSpec = true;
                }
            }

            if (!createdFromSpec)
            {
                // No spec template — create one bare execution (manual/ad-hoc path)
                var newExec = new TestExecution
                {
                    SampleId          = cmd.SampleId,
                    InstrumentId      = cmd.InstrumentId,
                    AnalystId         = cmd.AnalystId,
                    AssignedById      = cmd.AssignedById,
                    FormTemplateId    = sample.FormTemplateId,
                    PriorityScore     = cmd.PriorityScore,
                    SampleContainerId = cmd.ContainerId,
                    Status            = TestExecutionStatus.Assigned,
                    CreatedBy         = analyst.FullName,
                    CreatedAt         = DateTimeOffset.UtcNow
                };
                _db.TestExecutions.Add(newExec);
                executions.Add(newExec);
            }
        }

        // Flip container status → InUse
        if (container is not null)
            container.Status = LIMS.Domain.Enums.ContainerStatus.InUse;

        // Status stays PendingTesting until barcode is printed (wizard step 5 calls StartTestingCommand)
        await _db.SaveChangesAsync(ct);
        try { await _audit.LogAsync("WorkQueue", cmd.SampleId, "Assigned",
            null, new { cmd.AnalystId, cmd.InstrumentId, cmd.PriorityScore }, "System"); } catch { /* non-critical */ }
        return Result<int>.Success(executions.First().ExecutionId);
    }
}
