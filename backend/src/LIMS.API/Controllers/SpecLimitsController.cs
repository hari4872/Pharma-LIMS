using LIMS.Application.Features.MasterData.SpecLimits;
using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LIMS.API.Controllers;

[ApiController]
[Route("api/v1/spec-limits")]
[Authorize]
public class SpecLimitsController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly ILimsDbContext _db;

    public SpecLimitsController(IMediator mediator, ILimsDbContext db) { _mediator = mediator; _db = db; }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] int? materialId, [FromQuery] int? parameterId, [FromQuery] string? status)
    {
        var query = _db.SpecLimits.Include(s => s.Parameter).Include(s => s.Material).AsQueryable();
        if (materialId.HasValue) query = query.Where(s => s.MaterialId == materialId);
        if (parameterId.HasValue) query = query.Where(s => s.ParameterId == parameterId);
        if (!string.IsNullOrEmpty(status) && Enum.TryParse<ApprovalStatus>(status, out var st)) query = query.Where(s => s.Status == st);
        query = query.Where(s => s.IsActive);

        var results = await query.Select(s => new
        {
            s.SpecLimitId, s.ParameterId, ParameterName = s.Parameter.ParameterName,
            MaterialName = s.Material != null ? s.Material.MaterialName : null,
            s.MaterialId, Stage = s.Stage.ToString(), s.MinValue, s.MaxValue,
            RegulatoryTier = s.RegulatoryTier.ToString(), s.RegulatoryMin, s.RegulatoryMax,
            s.OotMinValue, s.OotMaxValue, Status = s.Status.ToString(), s.Version, s.ApprovedBy, s.ApprovedAt
        }).ToListAsync();
        return Ok(results);
    }

    [HttpPost]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> Create([FromBody] CreateSpecLimitRequest request)
    {
        var username = User.Identity?.Name ?? "Unknown";
        var spec = new SpecLimit
        {
            ParameterId = request.ParameterId, MaterialId = request.MaterialId,
            Stage = Enum.Parse<SpecStage>(request.Stage),
            MinValue = request.MinValue, MaxValue = request.MaxValue,
            RegulatoryTier = request.RegulatoryTier is not null ? Enum.Parse<RegulatoryTier>(request.RegulatoryTier) : null,
            RegulatoryMin = request.RegulatoryMin, RegulatoryMax = request.RegulatoryMax,
            OotMinValue = request.OotMinValue, OotMaxValue = request.OotMaxValue,
            CreatedBy = username, CreatedAt = DateTimeOffset.UtcNow
        };
        _db.SpecLimits.Add(spec);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetAll), new { id = spec.SpecLimitId }, new { specLimitId = spec.SpecLimitId });
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateSpecLimitRequest request)
    {
        var username = User.Identity?.Name ?? "Unknown";
        var result = await _mediator.Send(new UpdateSpecLimitCommand(id, request.MinValue, request.MaxValue, request.RegulatoryTier, request.RegulatoryMin, request.RegulatoryMax, request.OotMinValue, request.OotMaxValue, username));
        if (!result.IsSuccess) return result.ErrorCode == "NOT_FOUND" ? NotFound() : BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return Ok(new { specLimitId = result.Value, status = "Draft" });
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> Deactivate(int id, [FromBody] DeactivateRequest request)
    {
        var username = User.Identity?.Name ?? "Unknown";
        var result = await _mediator.Send(new DeactivateSpecLimitCommand(id, request.Reason, username));
        if (!result.IsSuccess) return result.ErrorCode == "NOT_FOUND" ? NotFound() : BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return Ok(new { specLimitId = result.Value, status = "Retired" });
    }

    [HttpPost("{id}/approve")]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> Approve(int id, [FromBody] ApproveRequest request)
    {
        var userId = int.Parse(User.FindFirst("sub")?.Value ?? "0");
        var result = await _mediator.Send(new ApproveSpecLimitCommand(id, userId, request.Password, request.Meaning, request.Reason));
        if (!result.IsSuccess)
        {
            if (result.ErrorCode == "ESIGN_AUTH_FAILED") return Unauthorized(new { error = result.ErrorCode, message = result.ErrorMessage });
            return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        }
        return Ok(new { specLimitId = result.Value, status = "Approved" });
    }
}

public record CreateSpecLimitRequest(int ParameterId, int MaterialId, string Stage, decimal? MinValue, decimal? MaxValue, string? RegulatoryTier, decimal? RegulatoryMin, decimal? RegulatoryMax, decimal? OotMinValue, decimal? OotMaxValue); // Gap 3 fix: MaterialId required
public record UpdateSpecLimitRequest(decimal? MinValue, decimal? MaxValue, string? RegulatoryTier, decimal? RegulatoryMin, decimal? RegulatoryMax, decimal? OotMinValue, decimal? OotMaxValue);
