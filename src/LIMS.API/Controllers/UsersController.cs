using LIMS.Application.Features.MasterData.Users;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LIMS.API.Controllers;

[ApiController]
[Route("api/v1/users")]
[Authorize]
public class UsersController : ControllerBase
{
    private readonly IMediator _mediator;
    public UsersController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetAll([FromQuery] int? labId, [FromQuery] bool includeInactive = false)
        => Ok(await _mediator.Send(new GetUsersQuery(labId, includeInactive)));

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Create([FromBody] CreateUserRequest request)
    {
        var username = User.Identity?.Name ?? "Unknown";
        var result = await _mediator.Send(new CreateUserCommand(
            request.Username, request.Password, request.FullName, request.Email,
            request.UserType, request.Role, request.LabId, username));
        if (!result.IsSuccess) return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return CreatedAtAction(nameof(GetAll), new { id = result.Value }, new { userId = result.Value });
    }
}

public record CreateUserRequest(string Username, string Password, string FullName, string Email, string UserType, string Role, int? LabId);
