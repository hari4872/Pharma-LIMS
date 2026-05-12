using LIMS.Infrastructure.Persistence;
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

        var token = GenerateJwt(user.UserId, user.Username, user.FullName, user.Role.ToString(), user.UserType.ToString());
        return Ok(new { token, userId = user.UserId, fullName = user.FullName, role = user.Role.ToString(), userType = user.UserType.ToString() });
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

    private string GenerateJwt(int userId, string username, string fullName, string role, string userType)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expiry = DateTime.UtcNow.AddMinutes(double.Parse(_config["Jwt:ExpiryMinutes"] ?? "480"));

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, userId.ToString()),
            new Claim(JwtRegisteredClaimNames.UniqueName, username),
            new Claim("fullName", fullName),
            new Claim(ClaimTypes.Role, role),
            new Claim("userType", userType)
        };

        var token = new JwtSecurityToken(_config["Jwt:Issuer"], _config["Jwt:Audience"], claims, expires: expiry, signingCredentials: creds);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

public record LoginRequest(string Username, string Password, bool RememberMe = false);
public record SetupRequest(string Username, string Password, string FullName, string Email);
