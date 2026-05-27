using LIMS.Application.Features.Samples;
using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace LIMS.API.Controllers;

/// <summary>
/// LabVantage parity: container/aliquot management per sample.
/// Route: api/v1/samples/{sampleId}/containers
/// </summary>
[ApiController]
[Route("api/v1/samples/{sampleId:int}/containers")]
[Authorize]
public class SampleContainersController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly ILimsDbContext _db;

    public SampleContainersController(IMediator mediator, ILimsDbContext db)
    { _mediator = mediator; _db = db; }

    // GET api/v1/samples/{sampleId}/containers
    [HttpGet]
    public async Task<IActionResult> GetContainers(int sampleId)
    {
        var containers = await _db.SampleContainers
            .Where(c => c.SampleId == sampleId)
            .OrderBy(c => c.CreatedAt)
            .Select(c => new {
                c.SampleContainerId, c.SampleId,
                c.ParentSampleContainerId, c.ContainerLabel,
                ContainerType   = c.ContainerType.ToString(),
                c.Volume, c.VolumeUom,
                c.StorageLocationId,
                Status          = c.Status.ToString(),
                c.CreatedBy, c.CreatedAt,
                c.DestroyedAt, c.DestroyedBy
            })
            .ToListAsync();

        return Ok(containers);
    }

    // POST api/v1/samples/{sampleId}/containers — split into aliquots
    [HttpPost]
    [Authorize(Roles = "Admin,QA,LabManager,Analyst")]
    public async Task<IActionResult> Split(int sampleId, [FromBody] SplitContainersRequest request)
    {
        var createdBy = User.Identity?.Name ?? "Unknown";
        var result = await _mediator.Send(new SplitSampleContainersCommand(
            sampleId, request.Count,
            Enum.TryParse<ContainerType>(request.ContainerType, true, out var ct) ? ct : ContainerType.Aliquot,
            request.VolumePerContainer, request.VolumeUom,
            request.StorageLocationId, createdBy));

        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.ErrorCode, message = result.ErrorMessage })
                : BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });

        return Ok(new { containerIds = result.Value, count = result.Value!.Count });
    }

    // POST api/v1/samples/{sampleId}/containers/{id}/destroy — e-sig required
    [HttpPost("{id:int}/destroy")]
    [Authorize(Roles = "Admin,QA,LabManager")]
    public async Task<IActionResult> Destroy(int sampleId, int id, [FromBody] DestroyContainerRequest request)
    {
        var container = await _db.SampleContainers
            .FirstOrDefaultAsync(c => c.SampleContainerId == id && c.SampleId == sampleId);
        if (container is null) return NotFound();
        if (container.Status == ContainerStatus.Destroyed)
            return BadRequest(new { error = "ALREADY_DESTROYED" });

        // Minimal e-sig via BCrypt re-auth (same pattern as other destruction endpoints)
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
        var user   = await _db.Users.FirstOrDefaultAsync(u => u.UserId == userId);
        if (user is null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            return Unauthorized(new { error = "ESIGN_AUTH_FAILED", message = "Password incorrect. (21 CFR §11.300)" });

        container.Status      = ContainerStatus.Destroyed;
        container.DestroyedAt = DateTimeOffset.UtcNow;
        container.DestroyedBy = user.FullName;

        _db.MasterDataAuditLogs.Add(new LIMS.Domain.Entities.MasterDataAuditLog
        {
            EntityType  = "SampleContainer",
            EntityId    = id,
            EventType   = "ContainerDestroyed",
            PerformedBy = user.FullName,
            NewValue    = $"{{\"reason\":\"{request.Reason}\"}}",
            PerformedAt = DateTimeOffset.UtcNow
        });

        await _db.SaveChangesAsync();
        return Ok(new { containerId = id, status = "Destroyed" });
    }
}

public record SplitContainersRequest(
    int Count, string ContainerType,
    decimal? VolumePerContainer, string? VolumeUom,
    int? StorageLocationId);

public record DestroyContainerRequest(string Password, string Reason);
