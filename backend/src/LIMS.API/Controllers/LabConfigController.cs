using LIMS.Application.Features.MasterData.LabConfigs;
using LIMS.Application.Interfaces;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LIMS.API.Controllers;

[ApiController]
[Route("api/v1/lab-config")]
[Authorize]
public class LabConfigController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly ILimsDbContext _db;
    public LabConfigController(IMediator mediator, ILimsDbContext db) { _mediator = mediator; _db = db; }

    // GET api/v1/lab-config?labId=1
    [HttpGet]
    public async Task<IActionResult> GetByLab([FromQuery] int labId)
        => Ok(await _mediator.Send(new GetLabConfigQuery(labId)));

    // PUT api/v1/lab-config — upsert a single key/value for a lab
    [HttpPut]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Upsert([FromBody] UpsertLabConfigRequest request)
    {
        var username = User.Identity?.Name ?? "Unknown";
        var result = await _mediator.Send(new UpsertLabConfigCommand(request.LabId, request.ConfigKey, request.ConfigValue, username));
        if (!result.IsSuccess) return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return Ok(new { configId = result.Value });
    }
    // POST api/v1/lab-config/logo?labId=1 — upload company logo (PNG/JPG, max 2MB)
    [HttpPost("logo")]
    [Authorize(Roles = "Admin")]
    [RequestSizeLimit(2_097_152)]
    public async Task<IActionResult> UploadLogo([FromQuery] int labId, IFormFile file, CancellationToken ct)
    {
        if (file is null || file.Length == 0) return BadRequest(new { error = "NO_FILE", message = "No file uploaded." });
        if (!file.ContentType.StartsWith("image/")) return BadRequest(new { error = "INVALID_TYPE", message = "Only image files are allowed." });

        using var ms = new MemoryStream();
        await file.CopyToAsync(ms, ct);
        var base64 = $"data:{file.ContentType};base64,{Convert.ToBase64String(ms.ToArray())}";

        var username = User.Identity?.Name ?? "System";
        var result = await _mediator.Send(new UpsertLabConfigCommand(labId, "coa_logo_base64", base64, username), ct);
        if (!result.IsSuccess) return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return Ok(new { message = "Logo saved." });
    }

    // GET api/v1/lab-config/logo?labId=1 — returns logo as base64 data URI
    [HttpGet("logo")]
    public async Task<IActionResult> GetLogo([FromQuery] int labId, CancellationToken ct)
    {
        var cfg = await _db.LabConfigs
            .Where(c => c.LabId == labId && c.ConfigKey == "coa_logo_base64")
            .OrderByDescending(c => c.UpdatedAt)
            .FirstOrDefaultAsync(ct);
        if (cfg is null || string.IsNullOrEmpty(cfg.ConfigValue))
            return NotFound(new { error = "NO_LOGO", message = "No logo uploaded for this lab." });
        return Ok(new { logoBase64 = cfg.ConfigValue });
    }
}

public record UpsertLabConfigRequest(int LabId, string ConfigKey, string ConfigValue);
