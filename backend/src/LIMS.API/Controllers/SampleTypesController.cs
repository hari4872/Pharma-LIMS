using LIMS.Application.Features.MasterData.SampleTypes;
using LIMS.Infrastructure.Persistence;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using LIMS.Domain.Entities;

namespace LIMS.API.Controllers;

[ApiController]
[Route("api/v1/sample-types")]
[Authorize]
public class SampleTypesController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly LimsDbContext _db;
    public SampleTypesController(IMediator mediator, LimsDbContext db)
    {
        _mediator = mediator;
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] bool includeInactive = false)
        => Ok(await _mediator.Send(new GetSampleTypesQuery(includeInactive)));

    [HttpPost]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> Create([FromBody] CreateSampleTypeRequest request)
    {
        var username = User.Identity?.Name ?? "Unknown";
        var result = await _mediator.Send(new CreateSampleTypeCommand(
            request.TypeName, request.TypeCode, request.Matrix, request.Stage,
            request.Description, username));
        if (!result.IsSuccess) return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return CreatedAtAction(nameof(GetAll), new { id = result.Value }, new { sampleTypeId = result.Value });
    }

    // GET /api/v1/sample-types/{id}/checkpoints — returns default checkpoint IDs for auto-select
    [HttpGet("{id:int}/checkpoints")]
    public async Task<IActionResult> GetDefaultCheckpoints(int id)
    {
        var ids = await _db.SampleTypeCheckpoints
            .Where(x => x.SampleTypeId == id)
            .Select(x => x.CheckpointId)
            .ToListAsync();
        return Ok(ids);
    }

    // PUT /api/v1/sample-types/{id}/checkpoints — save default checkpoint mapping
    [HttpPut("{id:int}/checkpoints")]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> SetDefaultCheckpoints(int id, [FromBody] List<int> checkpointIds)
    {
        // Remove existing mappings
        var existing = await _db.SampleTypeCheckpoints
            .Where(x => x.SampleTypeId == id)
            .ToListAsync();
        _db.SampleTypeCheckpoints.RemoveRange(existing);

        // Add new ones
        foreach (var cpId in checkpointIds.Distinct())
            _db.SampleTypeCheckpoints.Add(new SampleTypeCheckpoint { SampleTypeId = id, CheckpointId = cpId });

        await _db.SaveChangesAsync();
        return Ok(new { saved = checkpointIds.Count });
    }
}

public record CreateSampleTypeRequest(string TypeName, string TypeCode, string Matrix, string Stage, string? Description);
