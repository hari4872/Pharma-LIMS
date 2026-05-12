using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.MasterData.SpecLimits;

public record UpdateSpecLimitCommand(int SpecLimitId, decimal? MinValue, decimal? MaxValue,
    string? RegulatoryTier, decimal? RegulatoryMin, decimal? RegulatoryMax,
    decimal? OotMinValue, decimal? OotMaxValue, string UpdatedBy) : IRequest<Result<int>>;

public class UpdateSpecLimitCommandHandler : IRequestHandler<UpdateSpecLimitCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IMasterDataAuditService _audit;
    public UpdateSpecLimitCommandHandler(ILimsDbContext db, IMasterDataAuditService audit) { _db = db; _audit = audit; }

    public async Task<Result<int>> Handle(UpdateSpecLimitCommand request, CancellationToken ct)
    {
        var spec = await _db.SpecLimits.FirstOrDefaultAsync(s => s.SpecLimitId == request.SpecLimitId, ct);
        if (spec is null) return Result<int>.Failure("NOT_FOUND", "Spec limit not found.");

        // Version bump — old version retired, new version created as Draft
        var parts = spec.Version.Split('.');
        var newVersion = parts.Length == 2 ? $"{parts[0]}.{int.Parse(parts[1]) + 1}" : $"{spec.Version}.1";

        var old = new { spec.MinValue, spec.MaxValue, spec.RegulatoryTier, spec.RegulatoryMin, spec.RegulatoryMax, spec.OotMinValue, spec.OotMaxValue, spec.Version };
        spec.MinValue = request.MinValue; spec.MaxValue = request.MaxValue;
        spec.RegulatoryTier = request.RegulatoryTier is not null ? Enum.Parse<RegulatoryTier>(request.RegulatoryTier) : null;
        spec.RegulatoryMin = request.RegulatoryMin; spec.RegulatoryMax = request.RegulatoryMax;
        spec.OotMinValue = request.OotMinValue; spec.OotMaxValue = request.OotMaxValue;
        spec.Version = newVersion; spec.Status = ApprovalStatus.Draft;
        spec.SignatureId = null; spec.ApprovedBy = null; spec.ApprovedAt = null;
        await _db.SaveChangesAsync(ct);
        await _audit.LogAsync("SpecLimit", spec.SpecLimitId, "Updated", old,
            new { spec.MinValue, spec.MaxValue, spec.Version, status = "Draft" }, request.UpdatedBy);
        return Result<int>.Success(spec.SpecLimitId);
    }
}

public record DeactivateSpecLimitCommand(int SpecLimitId, string Reason, string UpdatedBy) : IRequest<Result<int>>;

public class DeactivateSpecLimitCommandHandler : IRequestHandler<DeactivateSpecLimitCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IMasterDataAuditService _audit;
    public DeactivateSpecLimitCommandHandler(ILimsDbContext db, IMasterDataAuditService audit) { _db = db; _audit = audit; }

    public async Task<Result<int>> Handle(DeactivateSpecLimitCommand request, CancellationToken ct)
    {
        var spec = await _db.SpecLimits.FirstOrDefaultAsync(s => s.SpecLimitId == request.SpecLimitId, ct);
        if (spec is null) return Result<int>.Failure("NOT_FOUND", "Spec limit not found.");
        spec.IsActive = false; spec.Status = ApprovalStatus.Retired;
        await _db.SaveChangesAsync(ct);
        await _audit.LogAsync("SpecLimit", spec.SpecLimitId, "Deactivated",
            new { IsActive = true }, new { IsActive = false, request.Reason }, request.UpdatedBy);
        return Result<int>.Success(spec.SpecLimitId);
    }
}
