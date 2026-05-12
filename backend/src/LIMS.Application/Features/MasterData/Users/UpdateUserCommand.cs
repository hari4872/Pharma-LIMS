using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.MasterData.Users;

public record UpdateUserCommand(int UserId, string FullName, string Email,
    string Role, int? LabId, string UpdatedBy) : IRequest<Result<int>>;

public class UpdateUserCommandHandler : IRequestHandler<UpdateUserCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IMasterDataAuditService _audit;
    public UpdateUserCommandHandler(ILimsDbContext db, IMasterDataAuditService audit) { _db = db; _audit = audit; }

    public async Task<Result<int>> Handle(UpdateUserCommand request, CancellationToken ct)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.UserId == request.UserId, ct);
        if (user is null) return Result<int>.Failure("NOT_FOUND", "User not found.");
        var old = new { user.FullName, user.Email, user.Role, user.LabId };
        user.FullName = request.FullName; user.Email = request.Email;
        user.Role = Enum.Parse<UserRole>(request.Role); user.LabId = request.LabId;
        await _db.SaveChangesAsync(ct);
        await _audit.LogAsync("User", user.UserId, "Updated", old,
            new { user.FullName, user.Email, user.Role }, request.UpdatedBy);
        return Result<int>.Success(user.UserId);
    }
}

public record DeactivateUserCommand(int UserId, string Reason, string UpdatedBy) : IRequest<Result<int>>;

public class DeactivateUserCommandHandler : IRequestHandler<DeactivateUserCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IMasterDataAuditService _audit;
    public DeactivateUserCommandHandler(ILimsDbContext db, IMasterDataAuditService audit) { _db = db; _audit = audit; }

    public async Task<Result<int>> Handle(DeactivateUserCommand request, CancellationToken ct)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.UserId == request.UserId, ct);
        if (user is null) return Result<int>.Failure("NOT_FOUND", "User not found.");
        if (user.IsTenantAdmin) return Result<int>.Failure("FORBIDDEN", "Cannot deactivate Tenant Admin.");
        user.IsActive = false;
        await _db.SaveChangesAsync(ct);
        await _audit.LogAsync("User", user.UserId, "Deactivated",
            new { IsActive = true }, new { IsActive = false, request.Reason }, request.UpdatedBy);
        return Result<int>.Success(user.UserId);
    }
}
