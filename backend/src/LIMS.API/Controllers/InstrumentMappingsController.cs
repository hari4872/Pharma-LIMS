using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LIMS.API.Controllers;

// ─────────────────────────────────────────────────────────────────────────────
// InstrumentMappingsController — Phase D
//
// CRUD for InstrumentTestMapping master data.
// Maps instruments to the TestMethods / Parameters they can execute.
// Drives the WorkQueue auto-suggest feature.
// ─────────────────────────────────────────────────────────────────────────────

[ApiController]
[Route("api/v1/instrument-mappings")]
[Authorize]
public class InstrumentMappingsController : ControllerBase
{
    private readonly ILimsDbContext _db;

    public InstrumentMappingsController(ILimsDbContext db) => _db = db;

    // ── GET /instrument-mappings ──────────────────────────────────────────────
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] int? instrumentId,
        [FromQuery] int? testMethodId,
        [FromQuery] bool? isActive)
    {
        var q = _db.InstrumentTestMappings
            .Include(m => m.Instrument).ThenInclude(i => i.Lab)
            .Include(m => m.TestMethod)
            .Include(m => m.Parameter)
            .AsQueryable();

        if (instrumentId.HasValue) q = q.Where(m => m.InstrumentId == instrumentId);
        if (testMethodId.HasValue) q = q.Where(m => m.TestMethodId == testMethodId);
        if (isActive.HasValue)     q = q.Where(m => m.IsActive == isActive);

        var list = await q.OrderBy(m => m.Instrument.InstrumentCode).ThenBy(m => m.Priority)
            .Select(m => new
            {
                m.MappingId, m.Priority, m.Notes, m.IsActive,
                m.CreatedBy, m.CreatedAt,
                Instrument = new {
                    m.Instrument.InstrumentId, m.Instrument.InstrumentCode,
                    m.Instrument.InstrumentType, m.Instrument.Status,
                    LabName = m.Instrument.Lab.LabName
                },
                TestMethod = m.TestMethod == null ? null : new {
                    m.TestMethod.MethodId, m.TestMethod.MethodName, m.TestMethod.MethodCode
                },
                Parameter = m.Parameter == null ? null : new {
                    m.Parameter.ParameterId, m.Parameter.ParameterName, m.Parameter.ParameterCode
                },
            }).ToListAsync();

        return Ok(list);
    }

    // ── POST /instrument-mappings ─────────────────────────────────────────────
    [HttpPost]
    [Authorize(Roles = "Admin,QA,LabManager")]
    public async Task<IActionResult> Create([FromBody] CreateInstrumentMappingRequest req)
    {
        if (req.TestMethodId == null && req.ParameterId == null)
            return BadRequest(new { error = "At least one of TestMethodId or ParameterId must be provided." });

        var user = User.Identity?.Name ?? "system";
        var mapping = new InstrumentTestMapping
        {
            InstrumentId = req.InstrumentId,
            TestMethodId = req.TestMethodId,
            ParameterId  = req.ParameterId,
            Priority     = req.Priority > 0 ? req.Priority : 1,
            Notes        = req.Notes,
            IsActive     = true,
            CreatedBy    = user,
            CreatedAt    = DateTimeOffset.UtcNow,
        };
        _db.InstrumentTestMappings.Add(mapping);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetAll), new { instrumentId = req.InstrumentId },
            new { mapping.MappingId });
    }

    // ── PUT /instrument-mappings/:id ──────────────────────────────────────────
    [HttpPut("{id:int}")]
    [Authorize(Roles = "Admin,QA,LabManager")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateInstrumentMappingRequest req)
    {
        var mapping = await _db.InstrumentTestMappings.FindAsync(id);
        if (mapping is null) return NotFound();

        mapping.Priority = req.Priority > 0 ? req.Priority : mapping.Priority;
        mapping.Notes    = req.Notes    ?? mapping.Notes;
        mapping.IsActive = req.IsActive ?? mapping.IsActive;

        await _db.SaveChangesAsync();
        return Ok(new { mapping.MappingId, mapping.Priority, mapping.IsActive });
    }

    // ── DELETE /instrument-mappings/:id ───────────────────────────────────────
    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin,QA,LabManager")]
    public async Task<IActionResult> Delete(int id)
    {
        var mapping = await _db.InstrumentTestMappings.FindAsync(id);
        if (mapping is null) return NotFound();
        _db.InstrumentTestMappings.Remove(mapping);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}

// ── Request DTOs ──────────────────────────────────────────────────────────────

public record CreateInstrumentMappingRequest(
    int     InstrumentId,
    int?    TestMethodId,
    int?    ParameterId,
    int     Priority,
    string? Notes);

public record UpdateInstrumentMappingRequest(
    int     Priority,
    string? Notes,
    bool?   IsActive);
