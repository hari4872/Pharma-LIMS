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
public class UsersController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly ILimsDbContext _db;
    public UsersController(IMediator mediator, ILimsDbContext db) { _mediator = mediator; _db = db; }

    [HttpGet]
    [Authorize(Roles = "Admin")]
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
        var result = await _mediator.Send(new UpdateUserCommand(id, request.FullName, request.Email, request.Role, request.LabId, username));
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
}

public record CreateUserRequest(string Username, string Password, string FullName, string Email, string UserType, string Role, int? LabId);
public record UpdateUserRequest(string FullName, string Email, string Role, int? LabId);
