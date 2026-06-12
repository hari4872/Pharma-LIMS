using System.ComponentModel.DataAnnotations;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LIMS.API.Controllers;

/// <summary>
/// Sprint 1 — Unified Quality Events: CAPA · Deviations · Complaints
/// Single controller, type-filtered via CdType query param.
/// Route: api/v1/quality-events
/// </summary>
[ApiController]
[Route("api/v1/quality-events")]
[Authorize]
public class QualityEventsController : ControllerBase
{
    private readonly ILimsDbContext _db;
    private readonly ILabContext _lab;
    private readonly IConfiguration _config;
    private readonly IHttpClientFactory _httpClientFactory;

    public QualityEventsController(ILimsDbContext db, ILabContext lab, IConfiguration config, IHttpClientFactory httpClientFactory)
    { _db = db; _lab = lab; _config = config; _httpClientFactory = httpClientFactory; }

    // GET api/v1/quality-events?type=Capa&status=Open&labId=1&sampleId=5
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? type,
        [FromQuery] string? status,
        [FromQuery] int? labId,
        [FromQuery] int? sampleId,
        [FromQuery] string? priority)
    {
        var q = _db.ComplaintsDeviations
            .Include(e => e.Sample)
            .Include(e => e.AssignedTo)
            .Include(e => e.Lab)
            .AsQueryable();

        // Lab isolation (MS-1): lab users see their lab, OR records assigned to them
        if (!_lab.IsCrossLab && _lab.LabId.HasValue)
        {
            var myUserId = _lab.UserId;
            q = q.Where(e => e.LabId == _lab.LabId || e.LabId == null || e.AssignedToUserId == myUserId);
        }

        if (!string.IsNullOrWhiteSpace(type) && Enum.TryParse<CdType>(type, true, out var cdType))
            q = q.Where(e => e.CdType == cdType);

        if (!string.IsNullOrWhiteSpace(status))
            q = q.Where(e => e.Status == status);

        if (labId.HasValue)
            q = q.Where(e => e.LabId == labId);

        if (sampleId.HasValue)
            q = q.Where(e => e.SampleId == sampleId);

        if (!string.IsNullOrWhiteSpace(priority))
            q = q.Where(e => e.Priority == priority);

        var results = await q
            .OrderByDescending(e => e.OpenedAt)
            .Select(e => new
            {
                e.CdId,
                cdType         = e.CdType.ToString(),
                e.CdReference,
                e.Title,
                e.Description,
                e.Status,
                e.Priority,
                e.RootCause,
                e.CorrectiveAction,
                e.PreventiveAction,
                e.SampleId,
                sampleNumber   = e.Sample != null ? e.Sample.SampleNumber : null,
                e.AssignedToUserId,
                assignedToName = e.AssignedTo != null ? e.AssignedTo.FullName : null,
                e.LabId,
                labName        = e.Lab != null ? e.Lab.LabName : null,
                e.LinkedOosId,
                e.DueDate,
                e.OpenedBy,
                e.OpenedAt,
                e.ResolvedAt,
                e.ResolvedBy,
                e.CAPARef,
            })
            .ToListAsync();

        return Ok(results);
    }

    // GET api/v1/quality-events/{id}
    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var e = await _db.ComplaintsDeviations
            .Include(e => e.Sample)
            .Include(e => e.AssignedTo)
            .Include(e => e.Lab)
            .Include(e => e.LinkedOos)
            .FirstOrDefaultAsync(e => e.CdId == id);

        if (e is null) return NotFound();

        return Ok(new
        {
            e.CdId,
            cdType            = e.CdType.ToString(),
            e.CdReference,
            e.Title,
            e.Description,
            e.Status,
            e.Priority,
            e.RootCause,
            e.CorrectiveAction,
            e.PreventiveAction,
            e.SampleId,
            sampleNumber      = e.Sample?.SampleNumber,
            e.AssignedToUserId,
            assignedToName    = e.AssignedTo?.FullName,
            e.LabId,
            labName           = e.Lab?.LabName,
            e.LinkedOosId,
            e.DueDate,
            e.OpenedBy,
            e.OpenedAt,
            e.ResolvedAt,
            e.ResolvedBy,
            e.UpdatedBy,
            e.UpdatedAt,
            e.CAPARef,
        });
    }

    // POST api/v1/quality-events — create CAPA / Deviation / Complaint
    [HttpPost]
    [Authorize(Roles = "Admin,QA,LabManager")]
    public async Task<IActionResult> Create([FromBody] CreateQualityEventRequest req)
    {
        if (!Enum.TryParse<CdType>(req.CdType, true, out var cdType))
            return BadRequest(new { error = "Invalid CdType. Use: Capa, Deviation, Complaint" });

        // Auto-generate reference number: CAPA-20260523-0001
        var prefix = cdType switch { CdType.Capa => "CAPA", CdType.Deviation => "DEV", _ => "COMP" };
        var today  = DateTimeOffset.UtcNow.ToString("yyyyMMdd");
        var count  = await _db.ComplaintsDeviations.CountAsync(e => e.CdType == cdType) + 1;
        var refNo  = $"{prefix}-{today}-{count:D4}";

        var entity = new ComplaintsDeviation
        {
            CdType           = cdType,
            CdReference      = refNo,
            Title            = req.Title,
            Description      = req.Description,
            Status           = "Open",
            Priority         = req.Priority ?? "Medium",
            RootCause        = req.RootCause,
            CorrectiveAction = req.CorrectiveAction,
            PreventiveAction = req.PreventiveAction,
            SampleId         = req.SampleId,
            AssignedToUserId = req.AssignedToUserId,
            LabId            = req.LabId ?? (_lab.IsCrossLab ? null : _lab.LabId),
            LinkedOosId      = req.LinkedOosId,
            DueDate          = req.DueDate.HasValue ? DateOnly.FromDateTime(req.DueDate.Value) : null,
            OpenedBy         = _lab.UserId > 0 ? _lab.UserId.ToString() : (User.Identity?.Name ?? "System"),
            OpenedAt         = DateTimeOffset.UtcNow,
        };

        _db.ComplaintsDeviations.Add(entity);
        await _db.SaveChangesAsync();

        // §11.10(e): INSERT-only audit trail
        _db.MasterDataAuditLogs.Add(new LIMS.Domain.Entities.MasterDataAuditLog
        {
            EntityType  = "QualityEvent",
            EntityId    = entity.CdId,
            EventType   = "Created",
            PerformedBy = User.Identity?.Name ?? "Unknown",
            NewValue    = $"{{\"reference\":\"{entity.CdReference}\",\"type\":\"{entity.CdType}\",\"title\":\"{entity.Title}\",\"priority\":\"{entity.Priority}\"}}",
            PerformedAt = DateTimeOffset.UtcNow
        });
        await _db.SaveChangesAsync();

        return Ok(new { entity.CdId, entity.CdReference, status = "Open" });
    }

    // PUT api/v1/quality-events/{id}
    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,QA,LabManager")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateQualityEventRequest req)
    {
        var entity = await _db.ComplaintsDeviations.FindAsync(id);
        if (entity is null) return NotFound();
        if (entity.Status == "Closed")
            return BadRequest(new { error = "Cannot modify a closed quality event." });

        if (!string.IsNullOrWhiteSpace(req.Title))            entity.Title            = req.Title;
        if (req.Description != null)                          entity.Description      = req.Description;
        if (!string.IsNullOrWhiteSpace(req.Status))          entity.Status           = req.Status;
        if (!string.IsNullOrWhiteSpace(req.Priority))        entity.Priority         = req.Priority;
        if (req.RootCause != null)                            entity.RootCause        = req.RootCause;
        if (req.CorrectiveAction != null)                     entity.CorrectiveAction = req.CorrectiveAction;
        if (req.PreventiveAction != null)                     entity.PreventiveAction = req.PreventiveAction;
        if (req.AssignedToUserId.HasValue)                    entity.AssignedToUserId = req.AssignedToUserId;
        if (req.DueDate.HasValue)                             entity.DueDate          = DateOnly.FromDateTime(req.DueDate.Value);
        if (req.CAPARef != null)                              entity.CAPARef          = req.CAPARef;

        // Close event
        if (req.Status is "Closed" or "Verified")
        {
            entity.ResolvedAt = DateTimeOffset.UtcNow;
            entity.ResolvedBy = User.Identity?.Name ?? "Unknown";
        }

        entity.UpdatedBy = User.Identity?.Name ?? "Unknown";
        entity.UpdatedAt = DateTimeOffset.UtcNow;

        // §11.10(e): INSERT-only audit trail — captures status transitions (Close, Verify, etc.)
        _db.MasterDataAuditLogs.Add(new LIMS.Domain.Entities.MasterDataAuditLog
        {
            EntityType  = "QualityEvent",
            EntityId    = entity.CdId,
            EventType   = req.Status is "Closed" or "Verified" ? $"StatusChanged:{req.Status}" : "Updated",
            PerformedBy = User.Identity?.Name ?? "Unknown",
            NewValue    = $"{{\"reference\":\"{entity.CdReference}\",\"status\":\"{entity.Status}\",\"capaRef\":\"{entity.CAPARef}\"}}",
            PerformedAt = DateTimeOffset.UtcNow
        });

        await _db.SaveChangesAsync();
        return Ok(new { entity.CdId, entity.Status });
    }

    // POST api/v1/quality-events/{id}/reopen — Admin/QA only, re-opens a Closed event
    [HttpPost("{id}/reopen")]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> Reopen(int id)
    {
        var entity = await _db.ComplaintsDeviations.FindAsync(id);
        if (entity is null) return NotFound();
        if (entity.Status != "Closed")
            return BadRequest(new { error = "Only Closed quality events can be reopened." });

        entity.Status    = "Open";
        entity.ResolvedAt = null;
        entity.ResolvedBy = null;
        entity.UpdatedBy = User.Identity?.Name ?? "Unknown";
        entity.UpdatedAt = DateTimeOffset.UtcNow;

        // §11.10(e): Reopen is a high-risk action — INSERT-only audit record
        _db.MasterDataAuditLogs.Add(new LIMS.Domain.Entities.MasterDataAuditLog
        {
            EntityType  = "QualityEvent",
            EntityId    = entity.CdId,
            EventType   = "Reopened",
            PerformedBy = User.Identity?.Name ?? "Unknown",
            NewValue    = $"{{\"reference\":\"{entity.CdReference}\",\"previousStatus\":\"Closed\",\"newStatus\":\"Open\"}}",
            PerformedAt = DateTimeOffset.UtcNow
        });

        await _db.SaveChangesAsync();
        return Ok(new { entity.CdId, entity.Status });
    }

    // DELETE api/v1/quality-events/{id} — Admin only, soft-via status = Void
    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Void(int id)
    {
        var entity = await _db.ComplaintsDeviations.FindAsync(id);
        if (entity is null) return NotFound();

        entity.Status    = "Void";
        entity.UpdatedBy = User.Identity?.Name ?? "Admin";
        entity.UpdatedAt = DateTimeOffset.UtcNow;

        // §11.10(e): Void is irreversible — INSERT-only audit record
        _db.MasterDataAuditLogs.Add(new LIMS.Domain.Entities.MasterDataAuditLog
        {
            EntityType  = "QualityEvent",
            EntityId    = entity.CdId,
            EventType   = "Voided",
            PerformedBy = User.Identity?.Name ?? "Unknown",
            NewValue    = $"{{\"reference\":\"{entity.CdReference}\",\"title\":\"{entity.Title}\"}}",
            PerformedAt = DateTimeOffset.UtcNow
        });

        await _db.SaveChangesAsync();
        return Ok(new { message = "Quality event voided." });
    }

    // POST api/v1/quality-events/classify — AI classification via Groq
    [HttpPost("classify")]
    public async Task<IActionResult> Classify([FromBody] ClassifyQualityEventRequest req)
    {
        var fallback = new
        {
            priority            = "Medium",
            cdType              = "Deviation",
            rootCauseCategory   = "Unknown",
            suggestedRootCause  = "",
            reasoning           = "Classification unavailable — please classify manually."
        };

        var groqApiKey = _config["Groq:ApiKey"];
        if (string.IsNullOrWhiteSpace(groqApiKey))
            return Ok(fallback);

        var prompt = $$"""
            You are a pharmaceutical quality management expert. Classify this quality event.

            Title: {{req.Title}}
            Description: {{req.Description ?? "(none)"}}

            Classify and return JSON only:
            {
              "priority": "Low|Medium|High|Critical",
              "cdType": "Capa|Deviation|Complaint",
              "rootCauseCategory": "Process|Human|Equipment|Material|Environment|Documentation|Unknown",
              "suggestedRootCause": "brief root cause hypothesis",
              "reasoning": "one sentence explanation"
            }

            Base priority on: Critical=patient safety/regulatory risk, High=product quality impact, Medium=process deviation, Low=minor documentation issue.
            """;

        try
        {
            var client = _httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", groqApiKey);

            var requestBody = new
            {
                model       = "llama-3.3-70b-versatile",
                messages    = new[] { new { role = "user", content = prompt } },
                max_tokens  = 400,
                temperature = 0.2,
            };

            var json     = JsonSerializer.Serialize(requestBody);
            var content  = new StringContent(json, Encoding.UTF8, "application/json");
            var response = await client.PostAsync("https://api.groq.com/openai/v1/chat/completions", content);

            if (!response.IsSuccessStatusCode)
                return Ok(fallback);

            var responseJson = await response.Content.ReadAsStringAsync();
            using var doc    = JsonDocument.Parse(responseJson);

            var messageContent = doc.RootElement
                .GetProperty("choices")[0]
                .GetProperty("message")
                .GetProperty("content")
                .GetString() ?? "";

            // Strip markdown code fences if present
            var cleaned = messageContent.Trim();
            if (cleaned.StartsWith("```"))
            {
                var firstNewline = cleaned.IndexOf('\n');
                var lastFence    = cleaned.LastIndexOf("```");
                if (firstNewline >= 0 && lastFence > firstNewline)
                    cleaned = cleaned[(firstNewline + 1)..lastFence].Trim();
            }

            using var resultDoc = JsonDocument.Parse(cleaned);
            var root = resultDoc.RootElement;

            return Ok(new
            {
                priority           = root.TryGetProperty("priority",           out var p)  ? p.GetString()  : "Medium",
                cdType             = root.TryGetProperty("cdType",             out var ct) ? ct.GetString() : "Deviation",
                rootCauseCategory  = root.TryGetProperty("rootCauseCategory",  out var rc) ? rc.GetString() : "Unknown",
                suggestedRootCause = root.TryGetProperty("suggestedRootCause", out var sr) ? sr.GetString() : "",
                reasoning          = root.TryGetProperty("reasoning",          out var r)  ? r.GetString()  : "",
            });
        }
        catch
        {
            return Ok(fallback);
        }
    }
}

public record CreateQualityEventRequest(
    [Required][MaxLength(50)]  string  CdType,
    [Required][MaxLength(500)] string  Title,
    [MaxLength(4000)]          string? Description,
    [MaxLength(50)]            string? Priority,
    [MaxLength(2000)]          string? RootCause,
    [MaxLength(2000)]          string? CorrectiveAction,
    [MaxLength(2000)]          string? PreventiveAction,
    int?      SampleId,
    int?      AssignedToUserId,
    int?      LabId,
    int?      LinkedOosId,
    DateTime? DueDate);

public record UpdateQualityEventRequest(
    [MaxLength(500)]  string? Title,
    [MaxLength(4000)] string? Description,
    [MaxLength(50)]   string? Status,
    [MaxLength(50)]   string? Priority,
    [MaxLength(2000)] string? RootCause,
    [MaxLength(2000)] string? CorrectiveAction,
    [MaxLength(2000)] string? PreventiveAction,
    int?      AssignedToUserId,
    DateTime? DueDate,
    [MaxLength(200)]  string? CAPARef);

public record ClassifyQualityEventRequest(string Title, string? Description);
