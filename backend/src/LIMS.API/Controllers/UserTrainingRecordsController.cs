using LIMS.Application.Features.MasterData.UserTrainingRecords;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LIMS.API.Controllers;

[ApiController]
[Route("api/v1/training-records")]
[Authorize]
public class UserTrainingRecordsController : ControllerBase
{
    private readonly IMediator _mediator;
    public UserTrainingRecordsController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] int? userId, [FromQuery] int? methodId)
        => Ok(await _mediator.Send(new GetUserTrainingRecordsQuery(userId, methodId)));

    [HttpPost]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> Create([FromBody] CreateTrainingRecordRequest request)
    {
        var username = User.Identity?.Name ?? "Unknown";
        var result = await _mediator.Send(new CreateUserTrainingRecordCommand(
            request.UserId, request.MethodId, request.TrainingDate, request.ValidUntil, username));
        if (!result.IsSuccess) return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return CreatedAtAction(nameof(GetAll), new { id = result.Value }, new { trainingId = result.Value });
    }
}

public record CreateTrainingRecordRequest(int UserId, int MethodId, DateOnly TrainingDate, DateOnly? ValidUntil);
