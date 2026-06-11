using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.MasterData.LabConfigs;

public record UpsertLabConfigCommand(int LabId, string ConfigKey, string ConfigValue, string UpdatedBy) : IRequest<Result<int>>;

public class UpsertLabConfigCommandValidator : AbstractValidator<UpsertLabConfigCommand>
{
    public UpsertLabConfigCommandValidator()
    {
        RuleFor(x => x.LabId).GreaterThan(0);
        RuleFor(x => x.ConfigKey).NotEmpty().MaximumLength(100);
        RuleFor(x => x.ConfigValue).NotEmpty();
    }
}

public class UpsertLabConfigCommandHandler : IRequestHandler<UpsertLabConfigCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IMasterDataAuditService _audit;
    public UpsertLabConfigCommandHandler(ILimsDbContext db, IMasterDataAuditService audit) { _db = db; _audit = audit; }

    public async Task<Result<int>> Handle(UpsertLabConfigCommand request, CancellationToken ct)
    {
        var existing = await _db.LabConfigs
            .FirstOrDefaultAsync(c => c.LabId == request.LabId && c.ConfigKey == request.ConfigKey, ct);

        if (existing is null)
        {
            var config = new LabConfig
            {
                LabId = request.LabId, ConfigKey = request.ConfigKey,
                ConfigValue = request.ConfigValue,
                UpdatedBy = request.UpdatedBy, UpdatedAt = DateTimeOffset.UtcNow
            };
            _db.LabConfigs.Add(config);
            await _db.SaveChangesAsync(ct);
            try { await _audit.LogAsync("LabConfig", config.ConfigId, "Created", null, config, request.UpdatedBy); } catch { /* non-critical */ }
            return Result<int>.Success(config.ConfigId);
        }

        var oldValue = new { existing.ConfigValue };
        existing.ConfigValue = request.ConfigValue;
        existing.UpdatedBy = request.UpdatedBy;
        existing.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        try { await _audit.LogAsync("LabConfig", existing.ConfigId, "Updated", oldValue, new { existing.ConfigValue }, request.UpdatedBy); } catch { /* non-critical */ }
        return Result<int>.Success(existing.ConfigId);
    }
}
