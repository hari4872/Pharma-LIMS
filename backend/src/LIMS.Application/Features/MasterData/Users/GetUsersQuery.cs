using LIMS.Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.MasterData.Users;

public record GetUsersQuery(int? LabId, bool IncludeInactive = false) : IRequest<List<UserDto>>;

public record UserDto(int UserId, string Username, string FullName, string Email,
    string UserType, string Role, int? LabId, string? LabName, bool IsActive,
    bool IsTenantAdmin, string CreatedBy, DateTimeOffset CreatedAt,
    string? CustomPermissionsJson, DateTimeOffset? LockedUntil = null);

public class GetUsersQueryHandler : IRequestHandler<GetUsersQuery, List<UserDto>>
{
    private readonly ILimsDbContext _db;
    public GetUsersQueryHandler(ILimsDbContext db) => _db = db;

    public async Task<List<UserDto>> Handle(GetUsersQuery request, CancellationToken ct)
    {
        var query = _db.Users.Include(u => u.Lab).AsQueryable();
        if (!request.IncludeInactive) query = query.Where(u => u.IsActive);
        if (request.LabId.HasValue) query = query.Where(u => u.LabId == request.LabId);

        // Fetch entities first so we can apply in-memory default substitution
        var users = await query.ToListAsync(ct);

        return users.Select(u => new UserDto(
            u.UserId, u.Username, u.FullName, u.Email,
            u.UserType.ToString(), u.Role.ToString(),
            u.LabId, u.Lab?.LabName,
            u.IsActive, u.IsTenantAdmin, u.CreatedBy, u.CreatedAt,
            // Return effective permissions: custom if set, else role defaults
            u.CustomPermissionsJson ?? GetDefaultPermissionsJson(u.Role.ToString()),
            u.LockedUntil
        )).ToList();
    }

    // Mirror of UsersController.GetDefaultPermissions — role-based defaults for users with no explicit grants
    private static string GetDefaultPermissionsJson(string role)
    {
        var defaults = role switch
        {
            "Admin"      => new Dictionary<string, bool> { ["masterData"]=true,  ["sampleRegistration"]=true,  ["workQueue"]=true,  ["resultsReview"]=true,  ["coaApproval"]=true,  ["batchRelease"]=true,  ["oosCapa"]=true,  ["compliance"]=true,  ["dispatchQc"]=true  },
            "QA"         => new Dictionary<string, bool> { ["masterData"]=true,  ["sampleRegistration"]=false, ["workQueue"]=false, ["resultsReview"]=true,  ["coaApproval"]=true,  ["batchRelease"]=true,  ["oosCapa"]=true,  ["compliance"]=true,  ["dispatchQc"]=true  },
            "QCLead"     => new Dictionary<string, bool> { ["masterData"]=false, ["sampleRegistration"]=true,  ["workQueue"]=true,  ["resultsReview"]=true,  ["coaApproval"]=false, ["batchRelease"]=false, ["oosCapa"]=true,  ["compliance"]=false, ["dispatchQc"]=false },
            "Analyst"    => new Dictionary<string, bool> { ["masterData"]=false, ["sampleRegistration"]=true,  ["workQueue"]=true,  ["resultsReview"]=false, ["coaApproval"]=false, ["batchRelease"]=false, ["oosCapa"]=false, ["compliance"]=false, ["dispatchQc"]=false },
            "LabManager" => new Dictionary<string, bool> { ["masterData"]=false, ["sampleRegistration"]=true,  ["workQueue"]=true,  ["resultsReview"]=false, ["coaApproval"]=false, ["batchRelease"]=true,  ["oosCapa"]=true,  ["compliance"]=false, ["dispatchQc"]=false },
            _            => new Dictionary<string, bool> { ["masterData"]=false, ["sampleRegistration"]=false, ["workQueue"]=false, ["resultsReview"]=false, ["coaApproval"]=false, ["batchRelease"]=false, ["oosCapa"]=false, ["compliance"]=false, ["dispatchQc"]=false },
        };
        return System.Text.Json.JsonSerializer.Serialize(defaults);
    }
}
