using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LIMS.API.Controllers;

[ApiController]
[Route("api/v1/admin/esign-config")]
[Authorize]
public class ESignConfigController : ControllerBase
{
    private readonly IESignConfigService _svc;
    public ESignConfigController(IESignConfigService svc) => _svc = svc;

    /// <summary>Returns all e-signature config rows — any authenticated user can read.</summary>
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var rows = await _svc.GetAllAsync(ct);
        return Ok(rows.Select(r => new
        {
            r.ActionKey,
            r.Method,
            r.FourEye,
            r.UpdatedBy,
            r.UpdatedAt,
        }));
    }

    /// <summary>Saves (upserts) all action rows — Admin only.</summary>
    [HttpPut]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> SaveAll([FromBody] List<ESignConfigRowDto> rows, CancellationToken ct)
    {
        if (rows is null || rows.Count == 0)
            return BadRequest(new { error = "EmptyPayload", message = "rows must not be empty" });

        var username = User.Identity?.Name ?? "unknown";
        var items = rows.Select(r => (r.ActionKey, r.Method, r.FourEye));
        await _svc.SaveAllAsync(items, username, ct);
        return Ok(new { saved = rows.Count });
    }
}

public record ESignConfigRowDto(string ActionKey, ESignMethod Method, bool FourEye);
