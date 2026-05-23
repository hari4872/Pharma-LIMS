using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Threading;

namespace LIMS.API.Controllers;

// ─────────────────────────────────────────────────────────────────────────────
// StabilityProtocolsController — Phase B
//
// CRUD for StabilityProtocol master data + interval management.
// QA/Admin manages; all authenticated users can read.
// ─────────────────────────────────────────────────────────────────────────────

[ApiController]
[Route("api/v1/stability-protocols")]
[Authorize]
public class StabilityProtocolsController : ControllerBase
{
    private readonly ILimsDbContext _db;
    private readonly IStabilityTrendService _trend;

    public StabilityProtocolsController(ILimsDbContext db, IStabilityTrendService trend)
    { _db = db; _trend = trend; }

    // ── GET /stability-protocols ──────────────────────────────────────────────
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] int? materialId,
        [FromQuery] string? storageCondition,
        [FromQuery] bool? isActive)
    {
        var q = _db.StabilityProtocols
            .Include(p => p.Material)
            .Include(p => p.Intervals)
            .Include(p => p.SpecTemplate)
            .AsQueryable();

        if (materialId.HasValue) q = q.Where(p => p.MaterialId == materialId);
        if (!string.IsNullOrEmpty(storageCondition) &&
            Enum.TryParse<StabilityStorageCondition>(storageCondition, out var sc))
            q = q.Where(p => p.StorageCondition == sc);
        if (isActive.HasValue) q = q.Where(p => p.IsActive == isActive);

        var list = await q.OrderByDescending(p => p.CreatedAt).Select(p => new
        {
            p.StabilityProtocolId, p.ProtocolName, p.StorageCondition,
            p.RegulatoryBasis, p.StudyDurationMonths,
            p.TargetTempC, p.TargetRhPct, p.Description, p.IsActive,
            p.CreatedBy, p.CreatedAt, p.UpdatedBy, p.UpdatedAt,
            Material     = new { p.Material.MaterialId, p.Material.MaterialName },
            SpecTemplate = p.SpecTemplate == null ? null : new { p.SpecTemplate.SpecTemplateId, p.SpecTemplate.TemplateName },
            IntervalCount = p.Intervals.Count,
            Intervals = p.Intervals.OrderBy(i => i.MonthOffset).Select(i => new
            {
                i.StabilityIntervalId, i.MonthOffset, i.Label,
                i.SampleUnitsRequired, i.ToleranceDays, i.IsMandatory
            }),
        }).ToListAsync();

        return Ok(list);
    }

    // ── GET /stability-protocols/:id ──────────────────────────────────────────
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var p = await _db.StabilityProtocols
            .Include(x => x.Material)
            .Include(x => x.Intervals)
            .Include(x => x.SpecTemplate)
            .FirstOrDefaultAsync(x => x.StabilityProtocolId == id);
        if (p is null) return NotFound();
        return Ok(p);
    }

    // ── POST /stability-protocols ─────────────────────────────────────────────
    [HttpPost]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> Create([FromBody] CreateStabilityProtocolRequest req)
    {
        var user = User.Identity?.Name ?? "system";
        var protocol = new StabilityProtocol
        {
            ProtocolName        = req.ProtocolName,
            MaterialId          = req.MaterialId,
            RegulatoryBasis     = req.RegulatoryBasis,
            StudyDurationMonths = req.StudyDurationMonths,
            StorageCondition    = req.StorageCondition,
            TargetTempC         = req.TargetTempC,
            TargetRhPct         = req.TargetRhPct,
            SpecTemplateId      = req.SpecTemplateId,
            Description         = req.Description,
            IsActive            = true,
            CreatedBy           = user,
            CreatedAt           = DateTimeOffset.UtcNow,
        };
        _db.StabilityProtocols.Add(protocol);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = protocol.StabilityProtocolId },
            new { protocol.StabilityProtocolId, protocol.ProtocolName });
    }

    // ── PUT /stability-protocols/:id ──────────────────────────────────────────
    [HttpPut("{id:int}")]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateStabilityProtocolRequest req)
    {
        var p = await _db.StabilityProtocols.FindAsync(id);
        if (p is null) return NotFound();

        p.ProtocolName        = req.ProtocolName        ?? p.ProtocolName;
        p.RegulatoryBasis     = req.RegulatoryBasis     ?? p.RegulatoryBasis;
        p.StudyDurationMonths = req.StudyDurationMonths ?? p.StudyDurationMonths;
        p.TargetTempC         = req.TargetTempC         ?? p.TargetTempC;
        p.TargetRhPct         = req.TargetRhPct         ?? p.TargetRhPct;
        p.SpecTemplateId      = req.SpecTemplateId      ?? p.SpecTemplateId;
        p.Description         = req.Description         ?? p.Description;
        p.IsActive            = req.IsActive            ?? p.IsActive;
        p.UpdatedBy           = User.Identity?.Name;
        p.UpdatedAt           = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync();
        return Ok(new { p.StabilityProtocolId, p.ProtocolName, p.IsActive });
    }

    // ── PUT /stability-protocols/:id/intervals — replace all intervals ─────────
    [HttpPut("{id:int}/intervals")]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> SaveIntervals(int id, [FromBody] List<SaveIntervalRequest> intervals)
    {
        var protocol = await _db.StabilityProtocols
            .Include(p => p.Intervals)
            .FirstOrDefaultAsync(p => p.StabilityProtocolId == id);
        if (protocol is null) return NotFound();

        // Validate no duplicate month offsets
        var offsets = intervals.Select(i => i.MonthOffset).ToList();
        if (offsets.Distinct().Count() != offsets.Count)
            return BadRequest(new { error = "Duplicate month offsets are not allowed within the same protocol." });

        _db.StabilityIntervals.RemoveRange(protocol.Intervals);

        foreach (var item in intervals.OrderBy(i => i.MonthOffset))
        {
            _db.StabilityIntervals.Add(new StabilityInterval
            {
                StabilityProtocolId  = id,
                MonthOffset          = item.MonthOffset,
                Label                = item.Label,
                SampleUnitsRequired  = item.SampleUnitsRequired > 0 ? item.SampleUnitsRequired : 1,
                ToleranceDays        = item.ToleranceDays,
                IsMandatory          = item.IsMandatory,
            });
        }

        protocol.UpdatedBy = User.Identity?.Name;
        protocol.UpdatedAt = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync();
        return Ok(new { stabilityProtocolId = id, intervalCount = intervals.Count });
    }

    // ── DELETE /stability-protocols/:id ───────────────────────────────────────
    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> Delete(int id)
    {
        var p = await _db.StabilityProtocols.FindAsync(id);
        if (p is null) return NotFound();
        _db.StabilityProtocols.Remove(p);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // GET api/v1/stability-protocols/{id}/trend?parameterId=
    [HttpGet("{id}/trend")]
    public async Task<IActionResult> GetTrend(int id, [FromQuery] int? parameterId, CancellationToken ct)
    {
        try { return Ok(await _trend.GetTrendDataAsync(id, parameterId, ct)); }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
    }

    // GET api/v1/stability-protocols/{id}/ich-compliance
    [HttpGet("{id}/ich-compliance")]
    public async Task<IActionResult> GetIchCompliance(int id, CancellationToken ct)
    {
        try { return Ok(await _trend.GetIchComplianceAsync(id, ct)); }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
    }
}

// ── Request DTOs ──────────────────────────────────────────────────────────────

public record CreateStabilityProtocolRequest(
    string                     ProtocolName,
    int                        MaterialId,
    string?                    RegulatoryBasis,
    int                        StudyDurationMonths,
    StabilityStorageCondition  StorageCondition,
    decimal?                   TargetTempC,
    decimal?                   TargetRhPct,
    int?                       SpecTemplateId,
    string?                    Description);

public record UpdateStabilityProtocolRequest(
    string?                    ProtocolName,
    string?                    RegulatoryBasis,
    int?                       StudyDurationMonths,
    decimal?                   TargetTempC,
    decimal?                   TargetRhPct,
    int?                       SpecTemplateId,
    string?                    Description,
    bool?                      IsActive);

public record SaveIntervalRequest(
    int     MonthOffset,
    string  Label,
    int     SampleUnitsRequired,
    int?    ToleranceDays,
    bool    IsMandatory);
