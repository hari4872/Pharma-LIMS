namespace LIMS.Application.Interfaces;

/// <summary>
/// Resolves the active laboratory context from the current JWT token.
/// Inject this into controllers/handlers instead of reading labId from the request body.
///
/// Security model (MS-1):
///   - labId is baked into the JWT at login time
///   - Backend reads it from the token — user cannot forge a different labId
///   - SuperAdmin / CorporateQA have labId = 0 and IsCrossLab = true (see all labs)
/// </summary>
public interface ILabContext
{
    /// <summary>The lab this user is authenticated for. Null = cross-lab user (SuperAdmin/CorporateQA).</summary>
    int? LabId { get; }

    /// <summary>Human-readable lab name from JWT claim.</summary>
    string LabName { get; }

    /// <summary>True if labId == 0 or missing — user can access all labs.</summary>
    bool IsCrossLab { get; }

    /// <summary>Authenticated user ID from JWT sub claim.</summary>
    int UserId { get; }

    /// <summary>Authenticated user's role from JWT role claim.</summary>
    string Role { get; }
}
