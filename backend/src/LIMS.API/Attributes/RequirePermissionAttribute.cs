using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using System.Security.Claims;

namespace LIMS.API.Attributes;

/// <summary>
/// Enforces custom per-user permission check for QCLead and LabManager roles.
/// Admin, QA, and Analyst bypass this check — they are governed by [Authorize(Roles=...)] alone.
/// QCLead and LabManager must have the specific permission granted by an Admin via the Permissions modal.
/// The permission is embedded in the JWT as the "permissions" claim (JSON object).
/// </summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class)]
public class RequirePermissionAttribute : Attribute, IAsyncActionFilter
{
    private readonly string _permissionKey;
    private static readonly HashSet<string> BypassRoles = ["Admin", "QA", "Analyst"];

    public RequirePermissionAttribute(string permissionKey) => _permissionKey = permissionKey;

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var user = context.HttpContext.User;
        var role = user.FindFirst("role")?.Value
                ?? user.FindFirst(ClaimTypes.Role)?.Value
                ?? string.Empty;

        // Admin, QA, Analyst always pass — custom permissions only restrict expanded roles
        if (BypassRoles.Contains(role)) { await next(); return; }

        // QCLead, LabManager: require the specific permission granted via admin
        var permJson = user.FindFirst("permissions")?.Value;
        if (!string.IsNullOrEmpty(permJson))
        {
            try
            {
                var perms = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, bool>>(permJson);
                if (perms != null && perms.TryGetValue(_permissionKey, out var granted) && granted)
                {
                    await next(); return;
                }
            }
            catch { /* malformed claim — deny */ }
        }

        context.Result = new ForbidResult();
    }
}
