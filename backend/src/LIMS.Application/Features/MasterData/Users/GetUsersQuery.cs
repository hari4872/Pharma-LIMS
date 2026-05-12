using LIMS.Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.MasterData.Users;

public record GetUsersQuery(int? LabId, bool IncludeInactive = false) : IRequest<List<UserDto>>;

public record UserDto(int UserId, string Username, string FullName, string Email,
    string UserType, string Role, int? LabId, string? LabName, bool IsActive,
    bool IsTenantAdmin, string CreatedBy, DateTimeOffset CreatedAt);

public class GetUsersQueryHandler : IRequestHandler<GetUsersQuery, List<UserDto>>
{
    private readonly ILimsDbContext _db;
    public GetUsersQueryHandler(ILimsDbContext db) => _db = db;

    public async Task<List<UserDto>> Handle(GetUsersQuery request, CancellationToken ct)
    {
        var query = _db.Users.Include(u => u.Lab).AsQueryable();
        if (!request.IncludeInactive) query = query.Where(u => u.IsActive);
        if (request.LabId.HasValue) query = query.Where(u => u.LabId == request.LabId);

        return await query.Select(u => new UserDto(
            u.UserId, u.Username, u.FullName, u.Email,
            u.UserType.ToString(), u.Role.ToString(),
            u.LabId, u.Lab != null ? u.Lab.LabName : null,
            u.IsActive, u.IsTenantAdmin, u.CreatedBy, u.CreatedAt)).ToListAsync(ct);
    }
}
