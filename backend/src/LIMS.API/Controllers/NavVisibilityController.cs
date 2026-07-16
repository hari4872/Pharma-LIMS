using LIMS.Domain.Entities;
using LIMS.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LIMS.API.Controllers;

[ApiController]
[Route("api/v1/nav-visibility")]
[Authorize]
public class NavVisibilityController : ControllerBase
{
    private readonly LimsDbContext _db;
    public NavVisibilityController(LimsDbContext db) { _db = db; }

    // Any authenticated user — sidebar reads this on load
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var rows = await _db.NavVisibilitySettings.ToListAsync();
        // Return as { key: isEnabled } map — absence means enabled (default ON)
        var map = rows.ToDictionary(r => r.Key, r => r.IsEnabled);
        return Ok(map);
    }

    // Admin only — saves the full visibility map
    [HttpPut]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<IActionResult> SaveAll([FromBody] List<NavVisibilityDto> items)
    {
        if (items is null || items.Count == 0)
            return BadRequest(new { error = "No items provided." });

        var username = User.Identity?.Name ?? "system";
        var now = DateTimeOffset.UtcNow;
        var isSuperAdmin = User.IsInRole("SuperAdmin");

        // Protected keys that can never be turned off — prevents Admin self-lockout
        var protectedKeys = new HashSet<string> { "sec.master-data", "md.nav-visibility", "nav.dashboard" };

        // Keys locked OFF by SuperAdmin — Admin cannot re-enable them
        var lockedKeys = isSuperAdmin
            ? new HashSet<string>()
            : (await _db.RoleModuleVisibilities
                .Where(r => r.IsLockedBySuperAdmin && !r.IsEnabled)
                .Select(r => r.NavKey)
                .ToListAsync())
                .ToHashSet();

        foreach (var item in items)
        {
            if (protectedKeys.Contains(item.Key)) continue;
            // Non-SuperAdmin cannot override a SuperAdmin lock
            if (!isSuperAdmin && lockedKeys.Contains(item.Key) && item.IsEnabled) continue;

            var existing = await _db.NavVisibilitySettings.FindAsync(item.Key);
            if (existing is null)
            {
                _db.NavVisibilitySettings.Add(new NavVisibilitySetting
                {
                    Key = item.Key,
                    IsEnabled = item.IsEnabled,
                    UpdatedBy = username,
                    UpdatedAt = now,
                });
            }
            else
            {
                existing.IsEnabled = item.IsEnabled;
                existing.UpdatedBy = username;
                existing.UpdatedAt = now;
            }
        }

        await _db.SaveChangesAsync();

        var map = (await _db.NavVisibilitySettings.ToListAsync())
            .ToDictionary(r => r.Key, r => r.IsEnabled);
        return Ok(map);
    }
}

public record NavVisibilityDto(string Key, bool IsEnabled);
