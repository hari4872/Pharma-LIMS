using LIMS.API.Pdf;
using LIMS.Application.Features.OosInvestigations;
using LIMS.Application.Interfaces;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QuestPDF.Fluent;
using QuestPDF.Infrastructure;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace LIMS.API.Controllers;

[ApiController]
[Route("api/v1/oos-investigations")]
[Authorize]
public class OosInvestigationsController : LimsControllerBase
{
    private readonly IMediator _mediator;
    private readonly ILimsDbContext _db;
    private readonly IConfiguration _config;
    private readonly IHttpClientFactory _http;
    public OosInvestigationsController(IMediator mediator, ILimsDbContext db, IConfiguration config, IHttpClientFactory http)
    { _mediator = mediator; _db = db; _config = config; _http = http; }

    // GET api/v1/oos-investigations?status=Open&labId=1&executionId=5
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? status, [FromQuery] int? labId, [FromQuery] int? executionId)
        => Ok(await _mediator.Send(new GetOosInvestigationsQuery(status, labId, executionId)));

    // GET api/v1/oos-investigations/eligible-entries?sampleNumber=XXX
    // Returns logbook entries for a sample that don't already have an OOS investigation — used by Add Record modal
    [HttpGet("eligible-entries")]
    [Authorize(Roles = "Admin,QA,LabManager")]
    public async Task<IActionResult> GetEligibleEntries([FromQuery] string sampleNumber)
    {
        if (string.IsNullOrWhiteSpace(sampleNumber))
            return BadRequest(new { error = "sampleNumber is required." });

        var sample = await _db.Samples
            .FirstOrDefaultAsync(s => s.SampleNumber == sampleNumber.Trim());
        if (sample is null)
            return NotFound(new { error = $"Sample '{sampleNumber}' not found." });

        var existingEntryIds = await _db.OosInvestigations
            .Select(i => i.EntryId)
            .ToListAsync();

        var entries = await _db.DigitalLogbookEntries
            .Include(e => e.Parameter)
            .Include(e => e.Execution)
            .Where(e => e.SampleId == sample.SampleId && !existingEntryIds.Contains(e.EntryId))
            .OrderByDescending(e => e.CreatedAt)
            .Select(e => new {
                e.EntryId, e.ExecutionId,
                e.Parameter.ParameterName,
                e.RawValue, e.CalculatedResult, e.PassFail,
                e.IsOos, e.IsOot,
                CreatedAt = e.CreatedAt
            })
            .ToListAsync();

        return Ok(new { sampleId = sample.SampleId, sampleNumber = sample.SampleNumber, entries });
    }

    // POST api/v1/oos-investigations — manual creation by QA
    [HttpPost]
    [Authorize(Roles = "Admin,QA,LabManager")]
    public async Task<IActionResult> Create([FromBody] CreateOosRequest request)
    {
        var userName = User.Identity?.Name ?? "QA";
        var result = await _mediator.Send(new CreateOosInvestigationCommand(request.EntryId, request.FlagType, userName));
        if (!result.IsSuccess)
        {
            if (result.ErrorCode == "NOT_FOUND") return NotFound(new { error = result.ErrorCode, message = result.ErrorMessage });
            return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        }
        return Ok(new { investigationId = result.Value });
    }

    // POST api/v1/oos-investigations/{id}/close � QA closes investigation §11.50 e-sig (FDA OOS Guidance)
    [HttpPost("{id}/close")]
    [Authorize(Roles = "Admin,QA,LabManager")]
    public async Task<IActionResult> Close(int id, [FromBody] CloseOosRequest request)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized(new { error = "Invalid token claims." });
        var result = await _mediator.Send(new CloseOosInvestigationCommand(
            id, userId, request.RootCause, request.CapaRef, request.CapaStatus, request.Password, request.Meaning, request.Reason));
        if (!result.IsSuccess)
        {
            if (result.ErrorCode == "ESIGN_AUTH_FAILED") return Unauthorized(new { error = result.ErrorCode, message = result.ErrorMessage });
            if (result.ErrorCode == "NOT_FOUND") return NotFound();
            return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        }
        return Ok(new { investigationId = result.Value, status = "Closed" });
    }

    // POST api/v1/oos-investigations/{id}/escalate-phase2 � Sprint 1: FDA OOS Phase 2 escalation
    [HttpPost("{id}/escalate-phase2")]
    [Authorize(Roles = "Admin,QA,LabManager")]
    public async Task<IActionResult> EscalateToPhase2(int id, [FromBody] EscalatePhase2Request request)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized(new { error = "Invalid token claims." });
        var result = await _mediator.Send(new EscalateToPhase2Command(
            id, userId, request.EscalationReason, request.CapaRef, request.CapaStatus,
            request.Password, request.Meaning, request.Reason));
        if (!result.IsSuccess)
        {
            if (result.ErrorCode == "ESIGN_AUTH_FAILED") return Unauthorized(new { error = result.ErrorCode, message = result.ErrorMessage });
            if (result.ErrorCode == "NOT_FOUND") return NotFound();
            return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        }
        return Ok(new { investigationId = result.Value, phase = "Phase2" });
    }

    // GET api/v1/oos-investigations/{id}/pdf � OOS Investigation Report PDF (FDA OOS Guidance + 21 CFR §211.192)
    [HttpGet("{id}/pdf")]
    public async Task<IActionResult> GetPdf(int id)
    {
        var inv = await _db.OosInvestigations
            .Include(i => i.Execution).ThenInclude(e => e.Sample).ThenInclude(s => s.Material)
            .Include(i => i.Entry).ThenInclude(e => e.Analyst)
            .Include(i => i.Parameter)
            .Include(i => i.Signature).ThenInclude(s => s!.User)
            .FirstOrDefaultAsync(i => i.InvestigationId == id);

        if (inv is null) return NotFound();

        var data = new OosPdfDocument.OosReportData(
            InvestigationId: inv.InvestigationId,
            SampleNumber:    inv.Execution.Sample.SampleNumber,
            MaterialName:    inv.Execution.Sample.Material.MaterialName,
            LotNumber:       inv.Execution.Sample.LotNumber,
            ParameterName:   inv.Parameter.ParameterName,
            Uom:             inv.Parameter.Uom ?? "�",
            FlagType:        inv.FlagType.ToString(),
            Phase:           inv.Phase.ToString(),
            Status:          inv.Status.ToString(),
            RawValue:        inv.Entry.RawValue,
            CalculatedResult: inv.Entry.CalculatedResult,
            SpecMin:         inv.Entry.SpecMinSnapshot,
            SpecMax:         inv.Entry.SpecMaxSnapshot,
            PassFail:        inv.Entry.PassFail,
            AnalystName:     inv.Entry.Analyst?.FullName ?? "Unknown",
            RootCause:       inv.RootCause,
            CapaRef:         inv.CapaRef,
            CreatedBy:       inv.CreatedBy,
            OpenedAt:        inv.OpenedAt,
            ClosedAt:        inv.ClosedAt,
            ClosedByName:    inv.Signature?.FullName
        );

        QuestPDF.Settings.License = LicenseType.Community;
        var doc   = new OosPdfDocument(data);
        var bytes = doc.GeneratePdf();
        var fname = $"OOS_{inv.InvestigationId:D5}_{inv.Execution.Sample.SampleNumber}.pdf";
        return File(bytes, "application/pdf", fname);
    }

    [Authorize(Roles = "Admin,QA,LabManager,Analyst")]
    // POST api/v1/oos-investigations/{id}/suggest-root-cause � AI root cause suggestions (Groq llama-3.3-70b)
    [HttpPost("{id}/suggest-root-cause")]
    public async Task<IActionResult> SuggestRootCause(int id)
    {
        // 1. Load OOS investigation
        var inv = await _db.OosInvestigations
            .Include(i => i.Parameter)
            .FirstOrDefaultAsync(i => i.InvestigationId == id);
        if (inv is null) return NotFound();

        // 2. Load test execution with analyst + instrument
        var execution = await _db.TestExecutions
            .Include(e => e.Analyst)
            .Include(e => e.Instrument)
            .FirstOrDefaultAsync(e => e.ExecutionId == inv.ExecutionId);

        var analystName    = execution?.Analyst?.FullName ?? "Unknown";
        var instrumentCode = execution?.Instrument?.InstrumentCode ?? "N/A";
        var calDue         = execution?.Instrument?.CalibrationDue.ToString("yyyy-MM-dd") ?? "N/A";

        // 3. Load last 10 logbook entries for same parameterId (ordered by CreatedAt desc)
        var history = await _db.DigitalLogbookEntries
            .Where(e => e.ParameterId == inv.ParameterId)
            .OrderByDescending(e => e.CreatedAt)
            .Take(10)
            .Select(e => new { e.RawValue, e.CalculatedResult, e.PassFail, e.CreatedAt })
            .ToListAsync();

        var resultHistory = history.Count > 0
            ? string.Join("\n", history.Select((e, i) =>
                $"  {i + 1}. Raw={e.RawValue}, Result={e.CalculatedResult?.ToString("F4") ?? "N/A"}, Status={e.PassFail}, Date={e.CreatedAt:yyyy-MM-dd}"))
            : "  No historical results available.";

        // 4. Load similar closed OOS investigations (same parameterId, last 5)
        var pastInvs = await _db.OosInvestigations
            .Where(i => i.ParameterId == inv.ParameterId && i.Status == LIMS.Domain.Enums.OosStatus.Closed && i.RootCause != null)
            .OrderByDescending(i => i.ClosedAt)
            .Take(5)
            .Select(i => i.RootCause!)
            .ToListAsync();

        var pastRootCauses = pastInvs.Count > 0
            ? string.Join("\n", pastInvs.Select((rc, i) => $"  {i + 1}. {rc}"))
            : "  No closed investigations found for this parameter.";

        // 5. Build Groq prompt
        var prompt = $@"You are a pharmaceutical QC expert. Based on the following OOS investigation data, suggest the 3 most likely root causes ranked by probability.

Investigation:
- Flag type: {inv.FlagType} (OOS = Out of Specification, OOT = Out of Trend)
- Phase: {inv.Phase}
- Parameter: {inv.Parameter.ParameterName}
- Analyst: {analystName}
- Instrument: {instrumentCode} (calibration due: {calDue})

Last 10 results for this parameter (most recent first):
{resultHistory}

Similar past investigations closed as:
{pastRootCauses}

Return JSON only:
{{""suggestions"":[{{""cause"":""..."",""confidence"":""High|Medium|Low"",""reasoning"":""...""}}],""disclaimer"":""AI suggestion only � investigator must verify per 21 CFR 211.192""}}";

        // 6. Call Groq API
        try
        {
            var apiKey = _config["Groq:ApiKey"] ?? throw new InvalidOperationException("Groq:ApiKey not configured");
            var client = _http.CreateClient();
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

            var requestBody = new
            {
                model = "llama-3.3-70b-versatile",
                messages = new[] { new { role = "user", content = prompt } },
                max_tokens = 600,
                temperature = 0.2
            };

            var json = JsonSerializer.Serialize(requestBody);
            var response = await client.PostAsync(
                "https://api.groq.com/openai/v1/chat/completions",
                new StringContent(json, Encoding.UTF8, "application/json"));

            var responseText = await response.Content.ReadAsStringAsync();
            using var groqDoc = JsonDocument.Parse(responseText);
            var content = groqDoc.RootElement
                .GetProperty("choices")[0]
                .GetProperty("message")
                .GetProperty("content")
                .GetString() ?? "";

            // Extract JSON from the response content (may have markdown fences)
            var jsonStart = content.IndexOf('{');
            var jsonEnd   = content.LastIndexOf('}');
            if (jsonStart >= 0 && jsonEnd > jsonStart)
                content = content[jsonStart..(jsonEnd + 1)];

            using var resultDoc = JsonDocument.Parse(content);
            return Ok(resultDoc.RootElement);
        }
        catch
        {
            // Fallback: return 3 generic pharma root causes
            var fallback = new
            {
                suggestions = new[]
                {
                    new { cause = "Analyst error or technique deviation", confidence = "Medium", reasoning = "Human error is the most common root cause in Phase 1 OOS investigations per FDA guidance. Re-test with second analyst recommended." },
                    new { cause = "Instrument calibration drift or malfunction", confidence = "Medium", reasoning = $"Instrument {instrumentCode} (cal due: {calDue}) should be verified. Calibration drift is a frequent contributor to OOS results." },
                    new { cause = "Sample integrity or storage condition deviation", confidence = "Low", reasoning = "Sample degradation due to improper storage temperature, light exposure, or container closure failure can produce OOS results." }
                },
                disclaimer = "AI suggestion only � investigator must verify per 21 CFR 211.192"
            };
            return Ok(fallback);
        }
    }
}

public record CloseOosRequest(string RootCause, string? CapaRef, string? CapaStatus, string Password, string Meaning, string Reason);
public record EscalatePhase2Request(string EscalationReason, string? CapaRef, string? CapaStatus, string Password, string Meaning, string Reason);
public record CreateOosRequest(int EntryId, string FlagType);

