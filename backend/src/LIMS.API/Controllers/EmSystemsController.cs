using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LIMS.API.Controllers;

[ApiController]
[Route("api/v1/em-systems")]
[Authorize]
public class EmSystemsController : ControllerBase
{
    private readonly ILimsDbContext _db;
    public EmSystemsController(ILimsDbContext db) => _db = db;

    // GET api/v1/em-systems
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var systems = await _db.EmSystems
            .Include(s => s.DefaultParameters)
                .ThenInclude(p => p.Parameter)
            .Where(s => s.IsActive)
            .OrderBy(s => s.SystemName)
            .Select(s => new
            {
                s.EmSystemId,
                s.SystemName,
                s.SystemCode,
                s.Description,
                s.IsActive,
                defaultParameters = s.DefaultParameters.Select(p => new
                {
                    p.EmSystemParameterId,
                    p.ParameterId,
                    parameterName = p.Parameter.ParameterName,
                    parameterCode = p.Parameter.ParameterCode,
                    uom           = p.Parameter.Uom,
                    p.AlertMin, p.AlertMax,
                    p.ActionMin, p.ActionMax,
                }).ToList()
            })
            .ToListAsync();

        return Ok(systems);
    }

    // GET api/v1/em-systems/{id}
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var s = await _db.EmSystems
            .Include(s => s.DefaultParameters).ThenInclude(p => p.Parameter)
            .FirstOrDefaultAsync(s => s.EmSystemId == id);

        if (s is null) return NotFound();

        return Ok(new
        {
            s.EmSystemId, s.SystemName, s.SystemCode, s.Description, s.IsActive,
            defaultParameters = s.DefaultParameters.Select(p => new
            {
                p.EmSystemParameterId, p.ParameterId,
                parameterName = p.Parameter.ParameterName,
                parameterCode = p.Parameter.ParameterCode,
                uom           = p.Parameter.Uom,
                p.AlertMin, p.AlertMax, p.ActionMin, p.ActionMax,
            })
        });
    }

    // POST api/v1/em-systems
    [HttpPost]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> Create([FromBody] CreateEmSystemRequest req)
    {
        if (await _db.EmSystems.AnyAsync(s => s.SystemCode == req.SystemCode))
            return BadRequest(new { error = "DUPLICATE_CODE", message = $"System code '{req.SystemCode}' already exists." });

        var system = new EmSystem
        {
            SystemName  = req.SystemName,
            SystemCode  = req.SystemCode,
            Description = req.Description,
            IsActive    = true,
            CreatedBy   = User.Identity?.Name ?? "admin",
            CreatedAt   = DateTimeOffset.UtcNow,
        };

        if (req.DefaultParameters != null)
            foreach (var p in req.DefaultParameters)
                system.DefaultParameters.Add(new EmSystemParameter
                {
                    ParameterId = p.ParameterId,
                    AlertMin  = p.AlertMin,  AlertMax  = p.AlertMax,
                    ActionMin = p.ActionMin, ActionMax = p.ActionMax,
                });

        _db.EmSystems.Add(system);
        await _db.SaveChangesAsync();
        return Ok(new { system.EmSystemId, system.SystemName, system.SystemCode });
    }

    // PUT api/v1/em-systems/{id}
    [HttpPut("{id:int}")]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateEmSystemRequest req)
    {
        var system = await _db.EmSystems
            .Include(s => s.DefaultParameters)
            .FirstOrDefaultAsync(s => s.EmSystemId == id);

        if (system is null) return NotFound();

        if (req.SystemName  is not null) system.SystemName  = req.SystemName;
        if (req.Description is not null) system.Description = req.Description;
        if (req.IsActive.HasValue)       system.IsActive    = req.IsActive.Value;

        if (req.DefaultParameters is not null)
        {
            // Replace all default parameters
            _db.EmSystemParameters.RemoveRange(system.DefaultParameters);
            foreach (var p in req.DefaultParameters)
                system.DefaultParameters.Add(new EmSystemParameter
                {
                    ParameterId = p.ParameterId,
                    AlertMin  = p.AlertMin,  AlertMax  = p.AlertMax,
                    ActionMin = p.ActionMin, ActionMax = p.ActionMax,
                });
        }

        await _db.SaveChangesAsync();
        return Ok(new { system.EmSystemId, system.SystemName });
    }

    // DELETE api/v1/em-systems/{id} — soft retire
    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Retire(int id)
    {
        var system = await _db.EmSystems.FindAsync(id);
        if (system is null) return NotFound();
        system.IsActive = false;
        await _db.SaveChangesAsync();
        return Ok(new { message = "System retired." });
    }
}

public record EmSystemParamRequest(
    int ParameterId,
    decimal? AlertMin, decimal? AlertMax,
    decimal? ActionMin, decimal? ActionMax);

public record CreateEmSystemRequest(
    string SystemName,
    string SystemCode,
    string? Description,
    List<EmSystemParamRequest>? DefaultParameters);

public record UpdateEmSystemRequest(
    string? SystemName,
    string? Description,
    bool? IsActive,
    List<EmSystemParamRequest>? DefaultParameters);
