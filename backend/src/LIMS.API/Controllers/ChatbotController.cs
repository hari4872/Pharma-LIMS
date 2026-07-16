using LIMS.Domain.Enums;
using LIMS.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace LIMS.API.Controllers;

[ApiController]
[Route("api/v1/chatbot")]
[Authorize]
public class ChatbotController : ControllerBase
{
    private readonly LimsDbContext _db;
    private readonly IConfiguration _config;
    private readonly IHttpClientFactory _http;

    public ChatbotController(LimsDbContext db, IConfiguration config, IHttpClientFactory http)
    { _db = db; _config = config; _http = http; }

    // ── Quick action — live DB snapshot ─────────────────────────────────────
    [HttpPost("quick")]
    public async Task<IActionResult> QuickAction([FromBody] QuickActionRequest req)
    {
        object result = req.Action switch
        {
            "attention"         => await GetAttentionAsync(),
            "pending-approvals" => await GetPendingApprovalsAsync(),
            "sample-status"     => await GetSampleStatusAsync(),
            "oos-results"       => await GetOosResultsAsync(),
            "overdue-tasks"     => await GetOverdueTasksAsync(),
            "equipment-status"  => await GetEquipmentStatusAsync(),
            _                   => (object)new { summary = "Unknown action." }
        };
        return Ok(result);
    }

    // ── Chat — Groq LLM with LIMS context ───────────────────────────────────
    [HttpPost("message")]
    public async Task<IActionResult> Chat([FromBody] ChatRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Message))
            return BadRequest(new { error = "Message is required." });

        var stats = await GetStatsAsync();
        var systemPrompt = $"""
            You are Aria, an intelligent lab assistant built into a Pharma LIMS (Laboratory Information Management System).
            You support laboratory personnel with sample lifecycle, QA workflows, 21 CFR Part 11 compliance, GxP, ALCOA+ principles, instrument calibration, OOS investigations, CoA review, and stability studies.

            Live system snapshot:
            - Total samples: {stats.TotalSamples}
            - Pending QA review: {stats.PendingQaReview}
            - In testing: {stats.InTesting}
            - Open OOS investigations: {stats.OpenOos}
            - Overdue samples: {stats.Overdue}
            - Available instruments: {stats.AvailableInstruments} of {stats.TotalInstruments}

            Rules:
            - Be concise, professional, and pharma/GxP domain-aware.
            - Never fabricate specific sample IDs, lot numbers, or test results.
            - When directing users to a module, always use one of these exact module names so the UI can show a navigation link:
              Sample Registration, Work Queue, Digital Logbook, OOS Investigations, CoA Review,
              Dispatch QC, Results Review, Batch Release, Dashboard, Compliance Panel,
              Reports & Exports, Stability Pulls, Retain Samples, Traceability, CAPA / Quality Events,
              SPC / Trending, Checkpoints, Stability Study.
            - Support 21 CFR Part 11, USP, ICH Q1A, GAMP 5, ALCOA+ questions confidently.
            """;

        var groqBody = new
        {
            model = "llama-3.3-70b-versatile",
            messages = new[]
            {
                new { role = "system", content = systemPrompt },
                new { role = "user",   content = req.Message }
            },
            max_tokens = 500,
            temperature = 0.7
        };

        var client = _http.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", _config["Groq:ApiKey"]);

        HttpResponseMessage response;
        try
        {
            response = await client.PostAsync(
                "https://api.groq.com/openai/v1/chat/completions",
                new StringContent(JsonSerializer.Serialize(groqBody), Encoding.UTF8, "application/json"));
        }
        catch
        {
            return StatusCode(503, new { error = "AI service unreachable. Please try again later." });
        }

        if (!response.IsSuccessStatusCode)
            return StatusCode(500, new { error = "AI service error. Please try again later." });

        string reply;
        try
        {
            using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            reply = doc.RootElement
                .GetProperty("choices")[0]
                .GetProperty("message")
                .GetProperty("content")
                .GetString() ?? "No response from AI service.";
        }
        catch
        {
            return StatusCode(500, new { error = "Failed to process AI response. Please try again." });
        }

        return Ok(new { reply });
    }

    // ── Translate — bulk UI string translation via Groq ──────────────────────
    [HttpPost("translate")]
    public async Task<IActionResult> Translate([FromBody] TranslateRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.TargetLanguage))
            return BadRequest(new { error = "TargetLanguage is required." });
        if (req.Strings == null || req.Strings.Count == 0)
            return BadRequest(new { error = "Strings map is empty." });

        var langName = req.TargetLanguage switch
        {
            "ja" => "Japanese",
            "id" => "Bahasa Indonesia",
            _    => req.TargetLanguage
        };

        var inputJson = JsonSerializer.Serialize(req.Strings);

        var groqBody = new
        {
            model = "llama-3.3-70b-versatile",
            messages = new[]
            {
                new {
                    role = "system",
                    content = $"""
                        You are a precise translation engine for pharmaceutical laboratory software (LIMS).
                        Translate every JSON value from English to {langName}.
                        Rules:
                        - Return ONLY valid JSON — no markdown, no code fences, no explanations.
                        - Keep every JSON key exactly as-is.
                        - Only translate the values.
                        - Keep pharma/GxP abbreviations in English: OOS, OOT, CoA, GMP, QA, QC, ALCOA+, SPC, GC, HPLC, ICH.
                        - Keep proper nouns and brand names unchanged.
                        - Match the tone: professional, concise, UI-label style (not full sentences where the original is a label).
                        """
                },
                new { role = "user", content = inputJson }
            },
            max_tokens  = 4096,
            temperature = 0.1
        };

        var client = _http.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", _config["Groq:ApiKey"]);

        HttpResponseMessage response;
        try
        {
            response = await client.PostAsync(
                "https://api.groq.com/openai/v1/chat/completions",
                new StringContent(JsonSerializer.Serialize(groqBody), Encoding.UTF8, "application/json"));
        }
        catch
        {
            return StatusCode(503, new { error = "AI translation service unreachable." });
        }

        if (!response.IsSuccessStatusCode)
            return StatusCode(500, new { error = "AI translation failed." });

        try
        {
            using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            var content = doc.RootElement
                .GetProperty("choices")[0]
                .GetProperty("message")
                .GetProperty("content")
                .GetString() ?? "{}";

            // Strip markdown fences if the model wrapped the JSON
            content = content.Trim();
            if (content.StartsWith("```")) content = content.Split('\n', 2)[1];
            if (content.EndsWith("```")) content = content[..content.LastIndexOf("```")].TrimEnd();

            using var translated = JsonDocument.Parse(content);
            return Ok(translated.RootElement.Clone());
        }
        catch
        {
            return StatusCode(500, new { error = "Failed to parse translation response." });
        }
    }

    // ── Quick action handlers ────────────────────────────────────────────────

    private async Task<object> GetAttentionAsync()
    {
        var overdue = await _db.Samples
            .CountAsync(s => s.DueDate.HasValue
                          && s.DueDate < DateTimeOffset.UtcNow
                          && s.Status != SampleStatus.Released
                          && s.Status != SampleStatus.Rejected);

        var openOos = await _db.OosInvestigations
            .CountAsync(o => o.Status == OosStatus.Open);

        var pendingQa = await _db.Samples
            .CountAsync(s => s.Status == SampleStatus.PendingQAReview);

        var items = new List<string>();
        if (overdue   > 0) items.Add($"⚠ {overdue} overdue sample{(overdue != 1 ? "s" : "")}");
        if (openOos   > 0) items.Add($"🔴 {openOos} open OOS investigation{(openOos != 1 ? "s" : "")}");
        if (pendingQa > 0) items.Add($"📋 {pendingQa} sample{(pendingQa != 1 ? "s" : "")} pending QA review");

        return new
        {
            overdue, openOos, pendingQa, items,
            summary = items.Count == 0
                ? "✅ All clear — nothing urgent needs your attention."
                : string.Join("\n", items)
        };
    }

    private async Task<object> GetPendingApprovalsAsync()
    {
        var pendingQa = await _db.Samples
            .Where(s => s.Status == SampleStatus.PendingQAReview)
            .Select(s => new { s.SampleId, s.SampleNumber, s.CreatedAt })
            .OrderBy(s => s.CreatedAt)
            .Take(10)
            .ToListAsync();

        var pendingCoas = await _db.Coas
            .CountAsync(c => c.Status == CoaStatus.Draft && c.QaSignatureId == null);

        return new
        {
            pendingQaSamples = pendingQa.Count,
            pendingCoas,
            samples = pendingQa,
            summary = $"{pendingQa.Count} sample{(pendingQa.Count != 1 ? "s" : "")} awaiting QA review, " +
                      $"{pendingCoas} CoA{(pendingCoas != 1 ? "s" : "")} pending approval."
        };
    }

    private async Task<object> GetSampleStatusAsync()
    {
        var counts = await _db.Samples
            .GroupBy(s => s.Status)
            .Select(g => new { Status = g.Key.ToString(), Count = g.Count() })
            .ToListAsync();

        var total = counts.Sum(c => c.Count);
        return new
        {
            total,
            breakdown = counts,
            summary = $"Total {total} samples across {counts.Count} status{(counts.Count != 1 ? "es" : "")}."
        };
    }

    private async Task<object> GetOosResultsAsync()
    {
        var investigations = await _db.OosInvestigations
            .Where(o => o.Status == OosStatus.Open)
            .Select(o => new { o.InvestigationId, o.OpenedAt, FlagType = o.FlagType.ToString(), Phase = o.Phase.ToString() })
            .OrderByDescending(o => o.OpenedAt)
            .Take(10)
            .ToListAsync();

        return new
        {
            openCount = investigations.Count,
            investigations,
            summary = investigations.Count == 0
                ? "✅ No open OOS investigations."
                : $"🔴 {investigations.Count} open OOS investigation{(investigations.Count != 1 ? "s" : "")}."
        };
    }

    private async Task<object> GetOverdueTasksAsync()
    {
        var overdue = await _db.Samples
            .Where(s => s.DueDate.HasValue
                     && s.DueDate < DateTimeOffset.UtcNow
                     && s.Status != SampleStatus.Released
                     && s.Status != SampleStatus.Rejected)
            .Select(s => new { s.SampleId, s.SampleNumber, s.DueDate, Status = s.Status.ToString() })
            .OrderBy(s => s.DueDate)
            .Take(10)
            .ToListAsync();

        return new
        {
            count = overdue.Count,
            samples = overdue,
            summary = overdue.Count == 0
                ? "✅ No overdue samples."
                : $"⚠ {overdue.Count} sample{(overdue.Count != 1 ? "s" : "")} past their due date."
        };
    }

    private async Task<object> GetEquipmentStatusAsync()
    {
        var counts = await _db.Instruments
            .Where(i => i.IsActive)
            .GroupBy(i => i.Status)
            .Select(g => new { Status = g.Key.ToString(), Count = g.Count() })
            .ToListAsync();

        var available     = counts.FirstOrDefault(c => c.Status == "Available")?.Count ?? 0;
        var inUse         = counts.FirstOrDefault(c => c.Status == "InUse")?.Count ?? 0;
        var maintenance   = counts.FirstOrDefault(c => c.Status == "Maintenance")?.Count ?? 0;
        var ooc           = counts.FirstOrDefault(c => c.Status == "OutOfCalibration")?.Count ?? 0;

        return new
        {
            breakdown = counts, available, inUse, maintenance, outOfCalibration = ooc,
            summary = $"{available} available, {inUse} in use, {maintenance} in maintenance, {ooc} out of calibration."
        };
    }

    private async Task<(int TotalSamples, int PendingQaReview, int InTesting, int OpenOos, int Overdue, int AvailableInstruments, int TotalInstruments)> GetStatsAsync()
    {
        var totalSamples         = await _db.Samples.CountAsync();
        var pendingQaReview      = await _db.Samples.CountAsync(s => s.Status == SampleStatus.PendingQAReview);
        var inTesting            = await _db.Samples.CountAsync(s => s.Status == SampleStatus.InTesting);
        var openOos              = await _db.OosInvestigations.CountAsync(o => o.Status == OosStatus.Open);
        var overdue              = await _db.Samples.CountAsync(s => s.DueDate.HasValue && s.DueDate < DateTimeOffset.UtcNow && s.Status != SampleStatus.Released && s.Status != SampleStatus.Rejected);
        var availableInstruments = await _db.Instruments.CountAsync(i => i.IsActive && i.Status == InstrumentStatus.Available);
        var totalInstruments     = await _db.Instruments.CountAsync(i => i.IsActive);

        return (totalSamples, pendingQaReview, inTesting, openOos, overdue, availableInstruments, totalInstruments);
    }
}

public record QuickActionRequest(string Action);
public record ChatRequest(string Message);
public record TranslateRequest(string TargetLanguage, Dictionary<string, string> Strings);
