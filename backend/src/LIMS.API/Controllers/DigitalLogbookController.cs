using LIMS.Application.Features.DigitalLogbook;
using LIMS.Application.Interfaces;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace LIMS.API.Controllers;

[ApiController]
[Route("api/v1/digital-logbook")]
[Authorize]
public class DigitalLogbookController : LimsControllerBase
{
    private readonly IMediator _mediator;
    private readonly ILimsDbContext _db;
    public DigitalLogbookController(IMediator mediator, ILimsDbContext db) { _mediator = mediator; _db = db; }

    // GET api/v1/digital-logbook?sampleId=1&executionId=2&labId=3&status=Signed&dateFrom=...&dateTo=...
    [HttpGet]
    public async Task<IActionResult> GetEntries(
        [FromQuery] int? sampleId, [FromQuery] int? executionId, [FromQuery] int? labId,
        [FromQuery] string? status,
        [FromQuery] DateTimeOffset? dateFrom, [FromQuery] DateTimeOffset? dateTo)
        => Ok(await _mediator.Send(new GetLogbookEntriesQuery(sampleId, executionId, labId, status, dateFrom, dateTo)));

    // POST api/v1/digital-logbook/{id}/amend — post-sign amendment; original preserved as Superseded
    // 21 CFR Â§11.10(e): original never deleted; amendment reason + e-sig mandatory
    [HttpPost("{id}/amend")]
    [Authorize(Roles = "Analyst,QCLead,QA,Admin")]
    public async Task<IActionResult> Amend(int id, [FromBody] AmendEntryRequest request)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized(new { error = "Invalid token claims." });
        var result = await _mediator.Send(new AmendLogbookEntryCommand(
            id, userId, request.NewRawValue, request.AmendmentReason,
            request.Password, request.Meaning, request.Reason));
        if (!result.IsSuccess)
        {
            if (result.ErrorCode == "ESIGN_AUTH_FAILED") return Unauthorized(new { error = result.ErrorCode, message = result.ErrorMessage });
            if (result.ErrorCode == "NOT_FOUND") return NotFound();
            return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        }
        return Ok(new { newEntryId = result.Value, originalEntryId = id, status = "AmendmentCreated" });
    }

    // GET api/v1/digital-logbook/export?format=csv — FR-09: export with all Â§11.50 manifestations
    [HttpGet("export")]
    [Authorize(Roles = "QA,QCLead,Admin")]
    public async Task<IActionResult> Export(
        [FromQuery] int? sampleId, [FromQuery] int? executionId, [FromQuery] int? labId,
        [FromQuery] string? status,
        [FromQuery] DateTimeOffset? dateFrom, [FromQuery] DateTimeOffset? dateTo,
        [FromQuery] string format = "csv")
    {
        var entries = await _mediator.Send(new GetLogbookEntriesQuery(sampleId, executionId, labId, status, dateFrom, dateTo));

        // Build CSV with all Â§11.50 audit columns
        var lines = new System.Text.StringBuilder();
        lines.AppendLine("EntryId,SampleNumber,ParameterName,RawValue,CalculatedResult,PassFail,IsOos,IsOot,SpecMin,SpecMax,AnalystName,SignedBy,SignedAt,TriggerSource,Status,InstrumentName,EvidenceFileRef");
        foreach (var e in entries)
        {
            lines.AppendLine($"{e.EntryId},{e.SampleNumber},{e.ParameterName}," +
                $"{e.RawValue},{e.CalculatedResult},{e.PassFail},{e.IsOos},{e.IsOot}," +
                $"{e.SpecMinSnapshot},{e.SpecMaxSnapshot}," +
                $"{e.AnalystName},{e.SignedByFullName},{e.SignedAt},{e.TriggerSource},{e.Status},{e.InstrumentName},{e.EvidenceFileRef}");
        }

        var bytes = System.Text.Encoding.UTF8.GetBytes(lines.ToString());
        var fileName = $"DigitalLogbook_{DateTimeOffset.UtcNow:yyyyMMdd_HHmmss}.csv";
        return File(bytes, "text/csv", fileName);
    }

    // POST api/v1/digital-logbook/entries/{id}/evidence
    [HttpPost("entries/{id}/evidence")]
    [Authorize(Roles = "Admin,Analyst,QA,QCLead")]
    public async Task<IActionResult> UploadEvidence(int id, IFormFile file, [FromForm] int sampleId, [FromForm] string? description, CancellationToken ct)
    {
        if (file is null || file.Length == 0) return BadRequest(new { error = "NO_FILE", message = "No file provided." });
        if (file.Length > 20 * 1024 * 1024) return BadRequest(new { error = "FILE_TOO_LARGE", message = "Max file size is 20 MB." });
        if (!TryGetUserId(out var userId)) return Unauthorized(new { error = "Invalid token claims." });

        using var ms = new MemoryStream();
        await file.CopyToAsync(ms, ct);

        var result = await _mediator.Send(new UploadEvidenceCommand(
            id, sampleId, file.FileName, ms.ToArray(), file.ContentType, description, userId), ct);

        if (!result.IsSuccess) return result.ErrorCode == "NOT_FOUND" ? NotFound() : BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return Ok(new { evidenceId = result.Value });
    }

    // GET api/v1/digital-logbook/entries/{id}/evidence
    [HttpGet("entries/{id}/evidence")]
    public async Task<IActionResult> GetEvidence(int id, CancellationToken ct)
    {
        var list = await _db.ResultEvidences
            .Where(e => e.EntryId == id)
            .Include(e => e.UploadedBy)
            .OrderBy(e => e.UploadedAt)
            .Select(e => new EvidenceDto(
                e.EvidenceId, e.FileRef, e.Description,
                e.UploadedBy.FullName, e.UploadedAt))
            .ToListAsync(ct);
        return Ok(list);
    }
}

public record AmendEntryRequest(string NewRawValue, string AmendmentReason, string Password, string Meaning, string Reason);

