using LIMS.Application.Features.MasterData.Users;
using LIMS.Application.Interfaces;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LIMS.API.Controllers;

[ApiController]
[Route("api/v1/users")]
[Authorize]
public class UsersController : LimsControllerBase
{
    private readonly IMediator _mediator;
    private readonly ILimsDbContext _db;
    public UsersController(IMediator mediator, ILimsDbContext db) { _mediator = mediator; _db = db; }

    [HttpGet]
    [Authorize(Roles = "SuperAdmin,Admin,QA,LabManager")]   // QA & LabManager need user list for task assignment; SuperAdmin audits all users
    public async Task<IActionResult> GetAll([FromQuery] int? labId, [FromQuery] bool includeInactive = false)
        => Ok(await _mediator.Send(new GetUsersQuery(labId, includeInactive)));

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Create([FromBody] CreateUserRequest request)
    {
        var username = User.Identity?.Name ?? "Unknown";
        var result = await _mediator.Send(new CreateUserCommand(request.Username, request.Password, request.FullName, request.Email, request.UserType, request.Role, request.LabId, username));
        if (!result.IsSuccess) return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return CreatedAtAction(nameof(GetAll), new { id = result.Value }, new { userId = result.Value });
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateUserRequest request)
    {
        var username = User.Identity?.Name ?? "Unknown";
        var result = await _mediator.Send(new UpdateUserCommand(id, request.FullName, request.Email, request.Role, request.LabId, request.IsActive, username));
        if (!result.IsSuccess) return result.ErrorCode == "NOT_FOUND" ? NotFound() : BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return Ok(new { userId = result.Value });
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Deactivate(int id, [FromBody] DeactivateRequest request)
    {
        var username = User.Identity?.Name ?? "Unknown";
        var result = await _mediator.Send(new DeactivateUserCommand(id, request.Reason, username));
        if (!result.IsSuccess) return result.ErrorCode == "NOT_FOUND" ? NotFound() : BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return Ok(new { userId = result.Value, status = "Inactive" });
    }

    // POST api/v1/users/{id}/unlock — Admin unlocks a locked account (21 CFR §11.10(d))
    [HttpPost("{id}/unlock")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Unlock(int id)
    {
        var adminName = User.Identity?.Name ?? "System";
        var user = await _db.Users.FirstOrDefaultAsync(u => u.UserId == id);
        if (user is null) return NotFound();

        user.LockedUntil       = null;
        user.FailedLoginCount  = 0;

        _db.MasterDataAuditLogs.Add(new LIMS.Domain.Entities.MasterDataAuditLog
        {
            EntityType  = "User",
            EntityId    = id,
            EventType   = "AccountUnlocked",
            PerformedBy = adminName,
            NewValue    = $"{{\"unlockedBy\":\"{adminName}\"}}",
            PerformedAt = DateTimeOffset.UtcNow
        });

        await _db.SaveChangesAsync();
        return Ok(new { userId = id, status = "Unlocked" });
    }

    // GET api/v1/users/{id}/permissions — Admin can view any user; any user can view their own
    [HttpGet("{id}/permissions")]
    [Authorize]
    public async Task<IActionResult> GetPermissions(int id)
    {
        if (!TryGetUserId(out var callerId)) return Unauthorized();
        if (!User.IsInRole("Admin") && callerId != id) return Forbid();

        var user = await _db.Users.FirstOrDefaultAsync(u => u.UserId == id);
        if (user is null) return NotFound(new { message = "User not found." });

        if (user.CustomPermissionsJson != null)
        {
            var custom = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, bool>>(user.CustomPermissionsJson);
            return Ok(new { userId = id, permissions = custom });
        }

        return Ok(new { userId = id, permissions = GetDefaultPermissions(user.Role.ToString()) });
    }

    // PUT api/v1/users/{id}/permissions — save custom permission matrix
    [HttpPut("{id}/permissions")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdatePermissions(int id, [FromBody] UpdatePermissionsRequest req)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.UserId == id);
        if (user is null) return NotFound(new { message = "User not found." });

        var oldJson = user.CustomPermissionsJson
            ?? System.Text.Json.JsonSerializer.Serialize(GetDefaultPermissions(user.Role.ToString()));
        var json = System.Text.Json.JsonSerializer.Serialize(req.Permissions);
        user.CustomPermissionsJson = json;

        var adminName = User.Identity?.Name ?? "System";
        _db.MasterDataAuditLogs.Add(new LIMS.Domain.Entities.MasterDataAuditLog
        {
            EntityType  = "UserPermissions",
            EntityId    = id,
            EventType   = "Updated",
            OldValue    = oldJson,
            NewValue    = json,
            PerformedBy = adminName,
            PerformedAt = DateTimeOffset.UtcNow
        });

        await _db.SaveChangesAsync();
        return Ok(new { userId = id, permissions = req.Permissions });
    }

    private static Dictionary<string, bool> GetDefaultPermissions(string role) => role switch
    {
        "SuperAdmin" => new() { ["masterData"]=true,  ["sampleRegistration"]=true,  ["workQueue"]=true,  ["resultsReview"]=true,  ["coaApproval"]=true,  ["batchRelease"]=true,  ["oosCapa"]=true,  ["compliance"]=true,  ["dispatchQc"]=true  },
        "Admin"      => new() { ["masterData"]=true,  ["sampleRegistration"]=true,  ["workQueue"]=true,  ["resultsReview"]=true,  ["coaApproval"]=true,  ["batchRelease"]=true,  ["oosCapa"]=true,  ["compliance"]=true,  ["dispatchQc"]=true  },
        "QA"         => new() { ["masterData"]=true,  ["sampleRegistration"]=false, ["workQueue"]=false, ["resultsReview"]=true,  ["coaApproval"]=true,  ["batchRelease"]=true,  ["oosCapa"]=true,  ["compliance"]=true,  ["dispatchQc"]=true  },
        "Analyst"    => new() { ["masterData"]=false, ["sampleRegistration"]=true,  ["workQueue"]=true,  ["resultsReview"]=false, ["coaApproval"]=false, ["batchRelease"]=false, ["oosCapa"]=false, ["compliance"]=false, ["dispatchQc"]=false },
        "LabManager" => new() { ["masterData"]=false, ["sampleRegistration"]=true,  ["workQueue"]=true,  ["resultsReview"]=false, ["coaApproval"]=false, ["batchRelease"]=true,  ["oosCapa"]=true,  ["compliance"]=false, ["dispatchQc"]=false },
        _            => new() { ["masterData"]=false, ["sampleRegistration"]=false, ["workQueue"]=false, ["resultsReview"]=false, ["coaApproval"]=false, ["batchRelease"]=false, ["oosCapa"]=false, ["compliance"]=false, ["dispatchQc"]=false },
    };
}

public record CreateUserRequest(string Username, string Password, string FullName, string Email, string UserType, string Role, int? LabId);
public record UpdateUserRequest(string FullName, string Email, string Role, int? LabId, bool IsActive = true);
public record UpdatePermissionsRequest(Dictionary<string, bool> Permissions);
