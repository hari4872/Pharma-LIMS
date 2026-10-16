using Microsoft.AspNetCore.Authorization;

namespace LIMS.API.Authorization;

/// <summary>
/// Grants SuperAdmin access to any role-based authorization requirement.
/// SuperAdmin is a cross-lab, cross-module role — it supersedes all per-role restrictions.
/// </summary>
public class SuperAdminAuthorizationHandler : IAuthorizationHandler
{
    public Task HandleAsync(AuthorizationHandlerContext context)
    {
        if (context.User.IsInRole("SuperAdmin"))
        {
            foreach (var requirement in context.PendingRequirements.ToList())
                context.Succeed(requirement);
        }
        return Task.CompletedTask;
    }
}
