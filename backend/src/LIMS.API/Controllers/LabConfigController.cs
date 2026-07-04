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
    // POST api/v1/lab-config/logo?labId=1 — upload company logo (PNG/JPG/GIF/WebP, max 2MB)
    [HttpPost("logo")]
    [Authorize(Roles = "Admin")]
    [RequestSizeLimit(2_097_152)]
    public async Task<IActionResult> UploadLogo([FromQuery] int labId, IFormFile file, CancellationToken ct)
    {
        if (file is null || file.Length == 0) return BadRequest(new { error = "NO_FILE", message = "No file uploaded." });
        if (!file.ContentType.StartsWith("image/")) return BadRequest(new { error = "INVALID_TYPE", message = "Only image files are allowed." });

        using var ms = new MemoryStream();
        await file.CopyToAsync(ms, ct);
        var bytes = ms.ToArray();

        // Magic bytes validation — guards against spoofed Content-Type headers
        if (!IsValidImageMagicBytes(bytes))
            return BadRequest(new { error = "INVALID_FILE", message = "File content does not match a supported image format (PNG, JPEG, GIF, WebP)." });

        var base64 = $"data:{file.ContentType};base64,{Convert.ToBase64String(bytes)}";

        var username = User.Identity?.Name ?? "System";
        var result = await _mediator.Send(new UpsertLabConfigCommand(labId, "coa_logo_base64", base64, username), ct);
        if (!result.IsSuccess) return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return Ok(new { message = "Logo saved." });
    }

    private static bool IsValidImageMagicBytes(byte[] b)
    {
        if (b.Length < 4) return false;
        // PNG: 89 50 4E 47
        if (b[0] == 0x89 && b[1] == 0x50 && b[2] == 0x4E && b[3] == 0x47) return true;
        // JPEG: FF D8 FF
        if (b[0] == 0xFF && b[1] == 0xD8 && b[2] == 0xFF) return true;
        // GIF: 47 49 46 38
        if (b[0] == 0x47 && b[1] == 0x49 && b[2] == 0x46 && b[3] == 0x38) return true;
        // WebP: 52 49 46 46 .. .. .. .. 57 45 42 50
        if (b.Length >= 12 && b[0] == 0x52 && b[1] == 0x49 && b[2] == 0x46 && b[3] == 0x46
            && b[8] == 0x57 && b[9] == 0x45 && b[10] == 0x42 && b[11] == 0x50) return true;
        return false;
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
