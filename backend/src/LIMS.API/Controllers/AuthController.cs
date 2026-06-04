using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Domain.Enums;
using LIMS.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace LIMS.API.Controllers;

[ApiController]
[Route("api/v1/auth")]
public class AuthController : ControllerBase
{
    private readonly LimsDbContext _db;
    private readonly IConfiguration _config;

    public AuthController(LimsDbContext db, IConfiguration config) { _db = db; _config = config; }

    // Contract 4: Login page — username · password · remember-me (all four in frontend)
    // 21 CFR §11.10(d): every attempt logged; 5 consecutive failures → 30-min lockout
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        if (string.IsNullOrEmpty(request.Username) || string.IsNullOrEmpty(request.Password))
            return BadRequest(new { error = "Username and password are required." });

        var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        var ua = Request.Headers.UserAgent.ToString();

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Username == request.Username);

        // Check account lockout before verifying password (§11.10(d))
        if (user is not null && user.LockedUntil.HasValue && user.LockedUntil > DateTimeOffset.UtcNow)
        {
            _db.LoginAuditLogs.Add(new LoginAuditLog
            {
                Username = request.Username, UserId = user.UserId,
                IpAddress = ip, UserAgent = ua,
                Outcome = LoginOutcome.AccountLocked,
                AttemptedAt = DateTimeOffset.UtcNow
            });
            await _db.SaveChangesAsync();
            var lockedMins = (int)Math.Ceiling((user.LockedUntil.Value - DateTimeOffset.UtcNow).TotalMinutes);
            return StatusCode(423, new { error = "ACCOUNT_LOCKED", message = $"Account locked. Try again in {lockedMins} minute(s)." });
        }

        // Validate credentials — same error message for not-found and wrong password (prevents user enumeration)
        bool credentialsValid = user is not null && user.IsActive &&
                                BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash);

        if (!credentialsValid)
        {
            var outcome = user is null ? LoginOutcome.UserNotFound
                        : !user.IsActive ? LoginOutcome.AccountInactive
                        : LoginOutcome.InvalidPassword;

            _db.LoginAuditLogs.Add(new LoginAuditLog
            {
                Username = request.Username, UserId = user?.UserId,
                IpAddress = ip, UserAgent = ua,
                Outcome = outcome, AttemptedAt = DateTimeOffset.UtcNow
            });

            if (user is not null && user.IsActive)
            {
                // Atomic increment — prevents concurrent brute-force bypass (21 CFR §11.10(d))
                await _db.Database.ExecuteSqlInterpolatedAsync($@"
                    UPDATE users
                    SET ""FailedLoginCount"" = ""FailedLoginCount"" + 1,
                        ""LockedUntil"" = CASE WHEN ""FailedLoginCount"" + 1 >= 5
                            THEN (NOW() AT TIME ZONE 'UTC' + INTERVAL '30 minutes')
                            ELSE ""LockedUntil"" END
                    WHERE ""UserId"" = {user.UserId} AND ""IsActive"" = true", CancellationToken.None);
                await _db.Entry(user).ReloadAsync();
            }

            await _db.SaveChangesAsync();
            return Unauthorized(new { error = "Invalid credentials." });
        }

        // Successful login — reset lockout counters
        user!.FailedLoginCount = 0;
        user.LockedUntil  = null;
        user.LastLoginAt  = DateTimeOffset.UtcNow;
        user.LastLoginIp  = ip;

        _db.LoginAuditLogs.Add(new LoginAuditLog
        {
            Username = request.Username, UserId = user.UserId,
            IpAddress = ip, UserAgent = ua,
            Outcome = LoginOutcome.Success, AttemptedAt = DateTimeOffset.UtcNow
        });

        // Load lab name for JWT claim
        string labName = "";
        if (user.LabId.HasValue)
        {
            var lab = await _db.Laboratories.FirstOrDefaultAsync(l => l.LabId == user.LabId.Value);
            labName = lab?.LabName ?? "";
        }

        await _db.SaveChangesAsync();

        var token = GenerateJwt(user.UserId, user.Username, user.FullName, user.Role.ToString(), user.UserType.ToString(), user.LabId, labName, user.CustomPermissionsJson);
        return Ok(new { token, userId = user.UserId, fullName = user.FullName, role = user.Role.ToString(), userType = user.UserType.ToString(), labId = user.LabId, labName });
    }

    // Contract 4: first-run Tenant Admin creation — before any other user or module
    [HttpPost("setup")]
    public async Task<IActionResult> Setup([FromBody] SetupRequest request)
    {
        var hasAdmin = await _db.Users.AnyAsync(u => u.IsTenantAdmin);
        if (hasAdmin) return Conflict(new { error = "Tenant Admin already configured." });

        // SEC-5: enforce minimum password policy on initial setup
        var setupPwd = request.Password ?? string.Empty;
        if (setupPwd.Length < 8 || !setupPwd.Any(char.IsUpper) || !setupPwd.Any(char.IsLower) || !setupPwd.Any(char.IsDigit) || !setupPwd.Any(c => !char.IsLetterOrDigit(c)))
            return BadRequest(new { error = "WEAK_PASSWORD", message = "Password must be at least 8 characters and contain uppercase, lowercase, digit, and special character." });

        var admin = new LIMS.Domain.Entities.User
        {
            Username = request.Username,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            FullName = request.FullName,
            Email = request.Email,
            UserType = LIMS.Domain.Enums.UserType.Admin,
            Role = LIMS.Domain.Enums.UserRole.Admin,
            IsTenantAdmin = true,
            CreatedBy = "System",
            CreatedAt = DateTimeOffset.UtcNow
        };

        _db.Users.Add(admin);
        await _db.SaveChangesAsync();
        return Ok(new { message = "Tenant Admin created successfully.", userId = admin.UserId });
    }

    [HttpGet("setup-required")]
    public async Task<IActionResult> SetupRequired()
    {
        var hasAdmin = await _db.Users.AnyAsync(u => u.IsTenantAdmin);
        return Ok(new { setupRequired = !hasAdmin });
    }

    // POST api/v1/auth/reset-password — Admin only (Contract 4: forgot-password requires admin authorisation)
    // §11.300: BCrypt re-hash of new password; audit-logged via MasterDataAuditService
    // No email-based reset — admin initiates; the reset itself is audit-trailed
    [HttpPost("reset-password")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
    {
        var adminUsername = User.Identity?.Name ?? "Unknown";

        var target = await _db.Users.FirstOrDefaultAsync(u => u.UserId == request.TargetUserId);
        if (target is null) return NotFound(new { error = "User not found." });

        var newPassword = request.NewPassword ?? string.Empty;
        if (newPassword.Length < 8 || !newPassword.Any(char.IsUpper) || !newPassword.Any(char.IsLower) || !newPassword.Any(char.IsDigit) || !newPassword.Any(c => !char.IsLetterOrDigit(c)))
            return BadRequest(new { error = "WEAK_PASSWORD", message = "Password must be at least 8 characters and contain uppercase, lowercase, digit, and special character." });

        // §11.300: BCrypt re-hash (independent of any session token)
        target.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);

        // INSERT-only audit log entry (§11.10(e))
        _db.MasterDataAuditLogs.Add(new LIMS.Domain.Entities.MasterDataAuditLog
        {
            EntityType  = "User",
            EntityId    = target.UserId,
            EventType   = "PasswordReset",
            PerformedBy = adminUsername,
            NewValue    = $"{{\"targetUserId\":{target.UserId},\"targetUsername\":\"{target.Username}\"}}",
            PerformedAt = DateTimeOffset.UtcNow
        });

        await _db.SaveChangesAsync();
        return Ok(new { message = $"Password reset for {target.Username}. User must sign in with new credentials." });
    }

    private string GenerateJwt(int userId, string username, string fullName, string role, string userType, int? labId, string labName, string? customPermissionsJson = null)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expiry = DateTime.UtcNow.AddMinutes(double.Parse(_config["Jwt:ExpiryMinutes"] ?? "480"));

        var claims = new List<Claim>
        {
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new Claim(JwtRegisteredClaimNames.Sub, userId.ToString()),
            new Claim(JwtRegisteredClaimNames.UniqueName, username),
            new Claim("fullName", fullName),
            new Claim(ClaimTypes.Role, role),   // long-form for ClaimsPrincipal.IsInRole
            new Claim("role", role),            // short-form for RoleClaimType="role"
            new Claim("userType", userType),
            // MS-1: lab identity baked into token — backend validates from here, not request body
            new Claim("labId",   labId?.ToString() ?? ""),   // empty string = no lab; never "0" (avoids silent filter-to-zero)
            new Claim("labName", labName),
        };

        if (!string.IsNullOrEmpty(customPermissionsJson))
            claims.Add(new Claim("permissions", customPermissionsJson));

        var token = new JwtSecurityToken(_config["Jwt:Issuer"], _config["Jwt:Audience"], claims, expires: expiry, signingCredentials: creds);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

public record LoginRequest(string Username, string Password, bool RememberMe = false);
public record SetupRequest(string Username, string Password, string FullName, string Email);
public record ResetPasswordRequest(int TargetUserId, string NewPassword);
