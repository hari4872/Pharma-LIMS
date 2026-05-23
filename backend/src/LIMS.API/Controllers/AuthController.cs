using LIMS.Application.Interfaces;
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
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        if (string.IsNullOrEmpty(request.Username) || string.IsNullOrEmpty(request.Password))
            return BadRequest(new { error = "Username and password are required." });

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Username == request.Username && u.IsActive);
        if (user is null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            return Unauthorized(new { error = "Invalid credentials." });

        // Load lab name for JWT claim
        string labName = "";
        if (user.LabId.HasValue)
        {
            var lab = await _db.Laboratories.FirstOrDefaultAsync(l => l.LabId == user.LabId.Value);
            labName = lab?.LabName ?? "";
        }
        var token = GenerateJwt(user.UserId, user.Username, user.FullName, user.Role.ToString(), user.UserType.ToString(), user.LabId, labName);
        return Ok(new { token, userId = user.UserId, fullName = user.FullName, role = user.Role.ToString(), userType = user.UserType.ToString(), labId = user.LabId, labName });
    }

    // Contract 4: first-run Tenant Admin creation — before any other user or module
    [HttpPost("setup")]
    public async Task<IActionResult> Setup([FromBody] SetupRequest request)
    {
        var hasAdmin = await _db.Users.AnyAsync(u => u.IsTenantAdmin);
        if (hasAdmin) return Conflict(new { error = "Tenant Admin already configured." });

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

        if (string.IsNullOrWhiteSpace(request.NewPassword) || request.NewPassword.Length < 8)
            return BadRequest(new { error = "New password must be at least 8 characters." });

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

    private string GenerateJwt(int userId, string username, string fullName, string role, string userType, int? labId, string labName)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expiry = DateTime.UtcNow.AddMinutes(double.Parse(_config["Jwt:ExpiryMinutes"] ?? "480"));

        var claims = new List<Claim>
        {
            new Claim(JwtRegisteredClaimNames.Sub, userId.ToString()),
            new Claim(JwtRegisteredClaimNames.UniqueName, username),
            new Claim("fullName", fullName),
            new Claim(ClaimTypes.Role, role),
            new Claim("userType", userType),
            // MS-1: lab identity baked into token — backend validates from here, not request body
            new Claim("labId",   labId?.ToString() ?? "0"),
            new Claim("labName", labName),
        };

        var token = new JwtSecurityToken(_config["Jwt:Issuer"], _config["Jwt:Audience"], claims, expires: expiry, signingCredentials: creds);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

public record LoginRequest(string Username, string Password, bool RememberMe = false);
public record SetupRequest(string Username, string Password, string FullName, string Email);
public record ResetPasswordRequest(int TargetUserId, string NewPassword);
