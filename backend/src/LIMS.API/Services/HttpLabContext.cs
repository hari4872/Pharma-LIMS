using LIMS.Application.Interfaces;
using System.Security.Claims;

namespace LIMS.API.Services;

/// <summary>
/// Reads lab identity from the current HTTP request's JWT claims.
/// Registered as Scoped — one instance per request.
/// </summary>
public class HttpLabContext : ILabContext
{
    private readonly IHttpContextAccessor _http;

    public HttpLabContext(IHttpContextAccessor http) => _http = http;

    private ClaimsPrincipal? User => _http.HttpContext?.User;

    public int? LabId
    {
        get
        {
            var val = User?.FindFirst("labId")?.Value;
            if (val is null) return null;
            return int.TryParse(val, out var id) && id > 0 ? id : null;
        }
    }

    public string LabName => User?.FindFirst("labName")?.Value ?? "";

    public bool IsCrossLab => LabId == null;

    public int UserId
    {
        get
        {
            var val = User?.FindFirst(ClaimTypes.NameIdentifier)?.Value
                   ?? User?.FindFirst(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub)?.Value;
            return val is not null && int.TryParse(val, out var id) ? id : 0;
        }
    }

    public string Role => User?.FindFirst(ClaimTypes.Role)?.Value ?? "";
}
