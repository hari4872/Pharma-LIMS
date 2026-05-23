using FluentValidation;
using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.MasterData.Reagents;

// ── GET ──────────────────────────────────────────────────────────────────────
public record GetReagentsQuery(bool IncludeInactive = false, int? MethodId = null) : IRequest<List<ReagentDto>>;

public record ReagentDto(
    int ReagentId, string ReagentCode, string ReagentName, string ReagentType,
    string LotNumber, decimal? Potency, string? PotencyUom, string? Manufacturer,
    DateOnly? ExpiryDate, DateOnly? OpenedDate, int? LinkedMethodId, string? MethodCode,
    string? StorageCondition, bool IsActive, string CreatedBy, DateTimeOffset CreatedAt);

public class GetReagentsHandler : IRequestHandler<GetReagentsQuery, List<ReagentDto>>
{
    private readonly ILimsDbContext _db;
    public GetReagentsHandler(ILimsDbContext db) => _db = db;

    public async Task<List<ReagentDto>> Handle(GetReagentsQuery q, CancellationToken ct)
    {
        var query = _db.ReagentStandards.Include(r => r.LinkedMethod).AsQueryable();
        if (!q.IncludeInactive) query = query.Where(r => r.IsActive);
        if (q.MethodId.HasValue) query = query.Where(r => r.LinkedMethodId == q.MethodId.Value);

        return await query.OrderBy(r => r.ReagentCode)
            .Select(r => new ReagentDto(
                r.ReagentId, r.ReagentCode, r.ReagentName, r.ReagentType,
                r.LotNumber, r.Potency, r.PotencyUom, r.Manufacturer,
                r.ExpiryDate, r.OpenedDate, r.LinkedMethodId,
                r.LinkedMethod != null ? r.LinkedMethod.MethodCode : null,
                r.StorageCondition, r.IsActive, r.CreatedBy, r.CreatedAt))
            .ToListAsync(ct);
    }
}

// ── CREATE ────────────────────────────────────────────────────────────────────
public record CreateReagentCommand(
    string ReagentCode, string ReagentName, string ReagentType,
    string LotNumber, decimal? Potency, string? PotencyUom, string? Manufacturer,
    DateOnly? ExpiryDate, DateOnly? OpenedDate, int? LinkedMethodId,
    string? StorageCondition, string CreatedBy) : IRequest<Result<int>>;

public class CreateReagentValidator : AbstractValidator<CreateReagentCommand>
{
    public CreateReagentValidator()
    {
        RuleFor(x => x.ReagentCode).NotEmpty().MaximumLength(50);
        RuleFor(x => x.ReagentName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.LotNumber).NotEmpty().MaximumLength(100);
        RuleFor(x => x.ReagentType).NotEmpty()
            .Must(t => new[] { "Reagent", "Standard", "ReferenceStandard" }.Contains(t))
            .WithMessage("ReagentType must be Reagent, Standard, or ReferenceStandard.");
    }
}

public class CreateReagentHandler : IRequestHandler<CreateReagentCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IMasterDataAuditService _audit;
    public CreateReagentHandler(ILimsDbContext db, IMasterDataAuditService audit) { _db = db; _audit = audit; }

    public async Task<Result<int>> Handle(CreateReagentCommand cmd, CancellationToken ct)
    {
        var dup = await _db.ReagentStandards.AnyAsync(r => r.ReagentCode == cmd.ReagentCode, ct);
        if (dup) return Result<int>.Failure("DUPLICATE", $"Reagent code '{cmd.ReagentCode}' already exists.");

        var reagent = new ReagentStandard
        {
            ReagentCode      = cmd.ReagentCode,
            ReagentName      = cmd.ReagentName,
            ReagentType      = cmd.ReagentType,
            LotNumber        = cmd.LotNumber,
            Potency          = cmd.Potency,
            PotencyUom       = cmd.PotencyUom,
            Manufacturer     = cmd.Manufacturer,
            ExpiryDate       = cmd.ExpiryDate,
            OpenedDate       = cmd.OpenedDate,
            LinkedMethodId   = cmd.LinkedMethodId,
            StorageCondition = cmd.StorageCondition,
            CreatedBy        = cmd.CreatedBy,
            CreatedAt        = DateTimeOffset.UtcNow
        };
        _db.ReagentStandards.Add(reagent);
        await _db.SaveChangesAsync(ct);
        await _audit.LogAsync("ReagentStandard", reagent.ReagentId, "Created", null,
            new { reagent.ReagentCode, reagent.ReagentName, reagent.LotNumber }, cmd.CreatedBy);
        return Result<int>.Success(reagent.ReagentId);
    }
}

// ── DEACTIVATE ────────────────────────────────────────────────────────────────
public record DeactivateReagentCommand(int ReagentId, string Reason, string UpdatedBy) : IRequest<Result<int>>;

public class DeactivateReagentHandler : IRequestHandler<DeactivateReagentCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IMasterDataAuditService _audit;
    public DeactivateReagentHandler(ILimsDbContext db, IMasterDataAuditService audit) { _db = db; _audit = audit; }

    public async Task<Result<int>> Handle(DeactivateReagentCommand cmd, CancellationToken ct)
    {
        var reagent = await _db.ReagentStandards.FirstOrDefaultAsync(r => r.ReagentId == cmd.ReagentId, ct);
        if (reagent is null) return Result<int>.Failure("NOT_FOUND", "Reagent not found.");
        reagent.IsActive = false;
        await _db.SaveChangesAsync(ct);
        await _audit.LogAsync("ReagentStandard", reagent.ReagentId, "Deactivated",
            new { IsActive = true }, new { IsActive = false, cmd.Reason }, cmd.UpdatedBy);
        return Result<int>.Success(reagent.ReagentId);
    }
}
