using Microsoft.AspNetCore.Mvc;

namespace LIMS.API.Controllers;

/// <summary>
/// Base controller that provides safe JWT claim helpers.
/// All controllers that read userId from the JWT token should inherit from this.
///
/// Prevents the userId=0 silent corruption bug where a missing/invalid "sub" claim
/// would default to 0, causing FK violations or orphaned audit records.
/// </summary>
public abstract class LimsControllerBase : ControllerBase
{
    /// <summary>
    /// Returns the authenticated user's ID from the JWT "sub" claim.
    /// Returns null if the claim is absent or not a valid integer.
    /// Callers should return Unauthorized() when this is null.
    /// </summary>
    protected int? TryGetUserId()
    {
        var raw = User.FindFirst("sub")?.Value;
        return int.TryParse(raw, out var id) && id > 0 ? id : null;
    }

    /// <summary>
    /// Returns the authenticated user's ID or immediately writes a 401 result.
    /// Usage:
    ///   if (!TryGetUserId(out var userId)) return _unauthorized;
    /// </summary>
    protected bool TryGetUserId(out int userId)
    {
        var raw = User.FindFirst("sub")?.Value;
        if (int.TryParse(raw, out userId) && userId > 0) return true;
        userId = 0;
        return false;
    }
}
