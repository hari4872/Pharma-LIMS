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
[Route("api/v1/shift-handover")]
[Authorize]
public class ShiftHandoverController : ControllerBase
{
    private readonly LimsDbContext _db;
    private readonly IConfiguration _config;
    private readonly IHttpClientFactory _http;

    public ShiftHandoverController(LimsDbContext db, IConfiguration config, IHttpClientFactory http)
    { _db = db; _config = config; _http = http; }

    // ── GET /api/v1/shift-handover/summary ──────────────────────────────────
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary()
    {
        try
        {
        // 1. In-progress test executions (status = InProgress)
        var inProgressList = await _db.TestExecutions
            .Where(e => e.Status == TestExecutionStatus.InProgress)
            .Select(e => new
            {
                sampleNumber = e.Sample.SampleNumber,
                analystName  = e.Analyst != null ? e.Analyst.FullName : "Unassigned",
                materialName = e.Sample.Material.MaterialName,
            })
            .ToListAsync();

        // 2. Assigned but not started
        var assignedCount = await _db.TestExecutions
            .CountAsync(e => e.Status == TestExecutionStatus.Assigned);

        // 3. Overdue samples — project enum as raw value, convert to string in memory
        var overdueRaw = await _db.Samples
            .Where(s => s.DueDate.HasValue
                     && s.DueDate < DateTimeOffset.UtcNow
                     && s.Status != SampleStatus.Released
                     && s.Status != SampleStatus.Rejected)
            .Select(s => new
            {
                sampleNumber = s.SampleNumber,
                dueDate      = s.DueDate,
                status       = s.Status,
            })
            .OrderBy(s => s.dueDate)
            .ToListAsync();
        var overdueList = overdueRaw.Select(s => new
        {
            s.sampleNumber,
            s.dueDate,
            status = s.status.ToString(),
        }).ToList();

        // 4. Open OOS investigations — project enum as raw value, convert to string in memory
        var oosRaw = await _db.OosInvestigations
            .Where(o => o.Status == OosStatus.Open)
            .Select(o => new
            {
                investigationId = o.InvestigationId,
                parameterName   = o.Parameter.ParameterName,
                phase           = o.Phase,
            })
            .ToListAsync();
        var oosList = oosRaw.Select(o => new
        {
            o.investigationId,
            o.parameterName,
            phase = o.phase.ToString(),
        }).ToList();

        // 5. Pending QA review samples
        var pendingQaCount = await _db.Samples
            .CountAsync(s => s.Status == SampleStatus.PendingQAReview);

        // 6. Instrument issues — project enum as raw value, convert to string in memory
        var instrumentRaw = await _db.Instruments
            .Where(i => i.IsActive &&
                       (i.Status == InstrumentStatus.OutOfCalibration ||
                        i.Status == InstrumentStatus.Maintenance))
            .Select(i => new
            {
                code   = i.InstrumentCode,
                status = i.Status,
            })
            .ToListAsync();
        var instrumentIssues = instrumentRaw.Select(i => new
        {
            i.code,
            status = i.status.ToString(),
        }).ToList();

        // 7. Pending peer reviews (Completed status = awaiting peer review)
        var pendingPeerReviewCount = await _db.TestExecutions
            .CountAsync(e => e.Status == TestExecutionStatus.Completed);

        // ── Build prompt ─────────────────────────────────────────────────────
        var analystList = inProgressList.Count > 0
            ? string.Join(", ", inProgressList.Select(x => $"{x.analystName} ({x.sampleNumber})"))
            : "none";

        var overdueDisplay = overdueList.Count > 0
            ? "(" + string.Join("; ", overdueList.Take(5).Select(o => $"{o.sampleNumber} due {o.dueDate:yyyy-MM-dd}")) + ")"
            : "";

        var oosDisplay = oosList.Count > 0
            ? "(" + string.Join("; ", oosList.Take(5).Select(o => $"#{o.investigationId} {o.parameterName} [{o.phase}]")) + ")"
            : "";

        var instrumentDisplay = instrumentIssues.Count > 0
            ? string.Join(", ", instrumentIssues.Select(i => $"{i.code} ({i.status})"))
            : "none";

        var prompt = $"""
            You are a pharmaceutical lab shift handover assistant. Generate a concise, professional shift handover summary for the outgoing shift lead. Use clear sections. Be specific with numbers. Flag urgent items.

            Current shift data:
            - Tests in progress: {inProgressList.Count} (analysts: {analystList})
            - Tests assigned, not started: {assignedCount}
            - Overdue samples: {overdueList.Count} {overdueDisplay}
            - Open OOS investigations: {oosList.Count} {oosDisplay}
            - Samples pending QA review: {pendingQaCount}
            - Instrument issues: {instrumentDisplay}
            - Tests pending peer review: {pendingPeerReviewCount}

            Generate a shift handover report with sections: ACTIVE WORK, URGENT ATTENTION, HANDOVER ITEMS, RECOMMENDED NEXT ACTIONS.
            """;

        // ── Call Groq ────────────────────────────────────────────────────────
        var groqBody = new
        {
            model = "llama-3.3-70b-versatile",
            messages = new[]
            {
                new { role = "user", content = prompt }
            },
            max_tokens  = 800,
            temperature = 0.3
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
        catch (Exception ex)
        {
            return StatusCode(503, new { error = "AI service unreachable.", detail = ex.Message });
        }

        if (!response.IsSuccessStatusCode)
        {
            var errBody = await response.Content.ReadAsStringAsync();
            return StatusCode(500, new { error = "AI service error.", detail = errBody });
        }

        string summary;
        try
        {
            using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            summary = doc.RootElement
                .GetProperty("choices")[0]
                .GetProperty("message")
                .GetProperty("content")
                .GetString() ?? "No response from AI service.";
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Failed to parse AI response.", detail = ex.Message });
        }

        return Ok(new
        {
            summary,
            generatedAt = DateTimeOffset.UtcNow.ToString("o"),
            data = new
            {
                inProgress = new
                {
                    count = inProgressList.Count,
                    items = inProgressList,
                },
                assigned = assignedCount,
                overdue = new
                {
                    count = overdueList.Count,
                    items = overdueList,
                },
                openOos = new
                {
                    count = oosList.Count,
                    items = oosList,
                },
                pendingQa           = pendingQaCount,
                instrumentIssues    = instrumentIssues,
                pendingPeerReview   = pendingPeerReviewCount,
            },
        });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Shift handover failed.", detail = ex.Message });
        }
    }
}
