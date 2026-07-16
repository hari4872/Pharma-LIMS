using LIMS.Domain.Entities;
using LIMS.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LIMS.API.Controllers;

[ApiController]
[Route("api/v1/superadmin")]
[Authorize(Roles = "SuperAdmin")]
public class SuperAdminController : ControllerBase
{
    private readonly LimsDbContext _db;
    public SuperAdminController(LimsDbContext db) { _db = db; }

    // ── Feature Flags ────────────────────────────────────────────────────────

    [HttpGet("feature-flags")]
    public async Task<IActionResult> GetFeatureFlags()
    {
        var flags = await _db.SuperAdminFeatureFlags.OrderBy(f => f.Key).ToListAsync();
        return Ok(flags.Select(f => new { f.Key, f.IsEnabled, f.UpdatedBy, f.UpdatedAt }));
    }

    [HttpPut("feature-flags")]
    public async Task<IActionResult> SaveFeatureFlags([FromBody] List<FeatureFlagDto> items)
    {
        if (items is null || items.Count == 0) return BadRequest(new { error = "No items provided." });

        var username = User.Identity?.Name ?? "superadmin";
        var now = DateTimeOffset.UtcNow;

        foreach (var item in items)
        {
            var existing = await _db.SuperAdminFeatureFlags.FindAsync(item.Key);
            if (existing is null)
            {
                _db.SuperAdminFeatureFlags.Add(new SuperAdminFeatureFlag
                {
                    Key = item.Key, IsEnabled = item.IsEnabled, UpdatedBy = username, UpdatedAt = now,
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

        var result = await _db.SuperAdminFeatureFlags.OrderBy(f => f.Key).ToListAsync();
        return Ok(result.Select(f => new { f.Key, f.IsEnabled, f.UpdatedBy, f.UpdatedAt }));
    }

    // ── Role Module Visibility ───────────────────────────────────────────────

    [HttpGet("module-visibility")]
    public async Task<IActionResult> GetModuleVisibility()
    {
        var rows = await _db.RoleModuleVisibilities.ToListAsync();

        // Return as { role: { navKey: { isEnabled, isLockedBySuperAdmin } } }
        var result = rows
            .GroupBy(r => r.Role)
            .ToDictionary(
                g => g.Key,
                g => g.ToDictionary(
                    r => r.NavKey,
                    r => new { r.IsEnabled, r.IsLockedBySuperAdmin, r.UpdatedBy, r.UpdatedAt }
                )
            );
        return Ok(result);
    }

    [HttpPut("module-visibility")]
    public async Task<IActionResult> SaveModuleVisibility([FromBody] List<RoleModuleVisibilityDto> items)
    {
        if (items is null || items.Count == 0) return BadRequest(new { error = "No items provided." });

        var username = User.Identity?.Name ?? "superadmin";
        var now = DateTimeOffset.UtcNow;

        foreach (var item in items)
        {
            var existing = await _db.RoleModuleVisibilities
                .FirstOrDefaultAsync(r => r.Role == item.Role && r.NavKey == item.NavKey);

            if (existing is null)
            {
                _db.RoleModuleVisibilities.Add(new RoleModuleVisibility
                {
                    Role = item.Role, NavKey = item.NavKey,
                    IsEnabled = item.IsEnabled, IsLockedBySuperAdmin = item.IsLockedBySuperAdmin,
                    UpdatedBy = username, UpdatedAt = now,
                });
            }
            else
            {
                existing.IsEnabled = item.IsEnabled;
                existing.IsLockedBySuperAdmin = item.IsLockedBySuperAdmin;
                existing.UpdatedBy = username;
                existing.UpdatedAt = now;
            }
        }
        await _db.SaveChangesAsync();
        return Ok(new { saved = items.Count });
    }

    // ── SuperAdmin Audit Log ─────────────────────────────────────────────────
    // Reads from MasterDataAuditLog filtered to superadmin actions

    [HttpGet("audit-log")]
    public async Task<IActionResult> GetAuditLog([FromQuery] int limit = 50)
    {
        var logs = await _db.MasterDataAuditLogs
            .Where(l => l.EventType.StartsWith("SuperAdmin") || l.PerformedBy == "superadmin")
            .OrderByDescending(l => l.PerformedAt)
            .Take(limit)
            .Select(l => new { l.EntityType, l.EventType, l.PerformedBy, l.PerformedAt, l.NewValue })
            .ToListAsync();
        return Ok(logs);
    }
}

public record FeatureFlagDto(string Key, bool IsEnabled);
public record RoleModuleVisibilityDto(string Role, string NavKey, bool IsEnabled, bool IsLockedBySuperAdmin);
