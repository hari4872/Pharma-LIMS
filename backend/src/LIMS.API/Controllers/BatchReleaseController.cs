using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LIMS.API.Controllers;

/// <summary>
/// Sprint 7 â€” Batch Release Workflow
/// 21 CFR 211.192: QA reviews each batch before release.
/// Auto-evaluates release checklist, then QA makes final decision with e-signature.
/// Route: api/v1/batch-releases
/// </summary>
[ApiController]
[Route("api/v1/batch-releases")]
[Authorize]
public class BatchReleaseController : LimsControllerBase
{
    private readonly ILimsDbContext _db;
    private readonly ILabContext _lab;
    private readonly IElectronicSignatureService _esig;
    private readonly INotificationService _notify;

    public BatchReleaseController(ILimsDbContext db, ILabContext lab,
        IElectronicSignatureService esig, INotificationService notify)
    { _db = db; _lab = lab; _esig = esig; _notify = notify; }

    // GET api/v1/batch-releases?status=PendingReview&labId=1
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? status, [FromQuery] int? labId)
    {
        var q = _db.BatchReleases
            .Include(r => r.Sample).ThenInclude(s => s.Material)
            .Include(r => r.InitiatedBy)
            .Include(r => r.ReviewedBy)
            .AsQueryable();

        // Lab isolation
        if (!_lab.IsCrossLab && _lab.LabId.HasValue)
            q = q.Where(r => r.Sample.LabId == _lab.LabId);
        else if (labId.HasValue)
            q = q.Where(r => r.Sample.LabId == labId);

        if (!string.IsNullOrWhiteSpace(status))
            q = q.Where(r => r.Status == Enum.Parse<BatchReleaseStatus>(status, true));

        var results = await q.OrderByDescending(r => r.InitiatedAt)
            .Select(r => new
            {
                r.BatchReleaseId,
                r.SampleId,
                sampleNumber    = r.Sample.SampleNumber,
                materialName    = r.Sample.Material != null ? r.Sample.Material.MaterialName : "Unknown",
                lotNumber       = r.Sample.LotNumber,
                status          = r.Status.ToString(),
                r.Decision,
                r.DecisionReason,
                initiatedBy     = r.InitiatedBy != null ? r.InitiatedBy.FullName : "Unknown",
                reviewedBy      = r.ReviewedBy != null ? r.ReviewedBy.FullName : null,
                r.InitiatedAt,
                r.DecidedAt,
            })
            .ToListAsync();

        return Ok(results);
    }

    // GET api/v1/batch-releases/{id}
    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var r = await _db.BatchReleases
            .Include(r => r.Sample).ThenInclude(s => s.Material)
            .Include(r => r.InitiatedBy)
            .Include(r => r.ReviewedBy)
            .FirstOrDefaultAsync(r => r.BatchReleaseId == id);
        if (r is null) return NotFound();

        var checkItems = await _db.BatchReleaseCheckItems
            .Where(c => c.BatchReleaseId == id)
            .Select(c => new { c.CheckType, c.Passed, c.Detail, c.EvaluatedAt })
            .ToListAsync();

        return Ok(new
        {
            r.BatchReleaseId, r.SampleId,
            sampleNumber = r.Sample.SampleNumber,
            materialName = r.Sample.Material != null ? r.Sample.Material.MaterialName : "Unknown",
            lotNumber    = r.Sample.LotNumber,
            status       = r.Status.ToString(),
            r.Decision,
            r.DecisionReason,
            r.ChecklistJson,
            checkItems,
            initiatedBy  = r.InitiatedBy != null ? r.InitiatedBy.FullName : "Unknown",
            reviewedBy   = r.ReviewedBy?.FullName,
            r.InitiatedAt, r.DecidedAt,
        });
    }

    // POST api/v1/batch-releases â€” initiate review for a sample
    [HttpPost]
    [Authorize(Roles = "Admin,QA,LabManager")]
    public async Task<IActionResult> Initiate([FromBody] InitiateBatchReleaseRequest req)
    {
        var sample = await _db.Samples
            .Include(s => s.Material)
            .FirstOrDefaultAsync(s => s.SampleId == req.SampleId);
        if (sample is null) return NotFound(new { error = "Sample not found." });

        if (sample.Status != SampleStatus.PendingQAReview)
            return BadRequest(new { error = $"Sample must be in PendingQAReview status. Current: {sample.Status}" });

        // Check if active review already exists
        var existing = await _db.BatchReleases.AnyAsync(r =>
            r.SampleId == req.SampleId &&
            (r.Status == BatchReleaseStatus.PendingReview || r.Status == BatchReleaseStatus.InReview));
        if (existing) return Conflict(new { error = "An active batch release review already exists for this sample." });

        if (!TryGetUserId(out var userId)) return Unauthorized(new { error = "Invalid token claims." });

        // Auto-evaluate checklist
        var checkItems = await EvaluateChecklistAsync(req.SampleId);

        var release = new BatchRelease
        {
            SampleId            = req.SampleId,
            Status              = BatchReleaseStatus.InReview,
            ChecklistJson       = System.Text.Json.JsonSerializer.Serialize(checkItems),
            InitiatedByUserId   = userId,
            InitiatedAt         = DateTimeOffset.UtcNow,
            CreatedBy           = User.Identity?.Name ?? "System",
            CreatedAt           = DateTimeOffset.UtcNow,
        };
        _db.BatchReleases.Add(release);
        await _db.SaveChangesAsync();

        // Add check items
        foreach (var ci in checkItems)
        {
            _db.BatchReleaseCheckItems.Add(new BatchReleaseCheckItem
            {
                BatchReleaseId = release.BatchReleaseId,
                CheckType      = ci.CheckType,
                Passed         = ci.Passed,
                Detail         = ci.Detail,
                EvaluatedAt    = DateTimeOffset.UtcNow,
            });
        }
        await _db.SaveChangesAsync();

        // Push to QA group
        await _notify.PushToGroupAsync("QA", "BatchReleaseInitiated",
            new { releaseId = release.BatchReleaseId, sampleNumber = sample.SampleNumber }, default);

        return Ok(new { release.BatchReleaseId, status = "InReview", checkItems });
    }

    // POST api/v1/batch-releases/{id}/decide â€” QA final release/reject/hold with Â§11.50 e-sig
    [HttpPost("{id}/decide")]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> Decide(int id, [FromBody] BatchReleaseDecisionRequest req)
    {
        var release = await _db.BatchReleases
            .Include(r => r.Sample)
            .FirstOrDefaultAsync(r => r.BatchReleaseId == id);
        if (release is null) return NotFound();

        if (release.Status == BatchReleaseStatus.Released || release.Status == BatchReleaseStatus.Rejected)
            return BadRequest(new { error = "Decision already made for this batch release." });

        if (string.IsNullOrWhiteSpace(req.Decision) ||
            !new[] { "Released", "Rejected", "OnHold" }.Contains(req.Decision))
            return BadRequest(new { error = "Decision must be: Released | Rejected | OnHold" });

        if (string.IsNullOrWhiteSpace(req.DecisionReason))
            return BadRequest(new { error = "DecisionReason is required." });

        if (!TryGetUserId(out var userId)) return Unauthorized(new { error = "Invalid token claims." });

        // Â§11.50 e-signature required for batch release decision (21 CFR 211.192)
        var sig = await _esig.CreateSignatureAsync(
            userId, req.Password, req.Meaning, req.Reason,
            "BatchRelease.Decision", default);
        if (sig is null)
            return Unauthorized(new { error = "ESIGN_AUTH_FAILED", message = "Password incorrect â€” e-signature rejected. (21 CFR Â§11.300)" });

        // Update release
        release.Status         = Enum.Parse<BatchReleaseStatus>(req.Decision, true);
        release.Decision       = req.Decision;
        release.DecisionReason = req.DecisionReason;
        release.SignatureId    = sig.SignatureId;
        release.ReviewedByUserId = userId;
        release.DecidedAt      = DateTimeOffset.UtcNow;

        // Update sample status
        release.Sample.Status = req.Decision switch
        {
            "Released" => SampleStatus.Released,
            "Rejected" => SampleStatus.Rejected,
            _ => release.Sample.Status  // OnHold: keep current status
        };

        await _db.SaveChangesAsync();

        // Push to LabManager + AllUsers
        await _notify.PushToGroupAsync("LabManager", "BatchDecision",
            new { releaseId = id, sampleNumber = release.Sample.SampleNumber, decision = req.Decision }, default);

        return Ok(new { release.BatchReleaseId, decision = req.Decision, sampleStatus = release.Sample.Status.ToString() });
    }

    // â”€â”€ Private Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    private async Task<List<ChecklistItem>> EvaluateChecklistAsync(int sampleId)
    {
        var items = new List<ChecklistItem>();

        // Check 1: All test executions completed
        var executions = await _db.TestExecutions
            .Where(e => e.SampleId == sampleId)
            .ToListAsync();
        bool allDone = executions.Any() &&
                       executions.All(e => e.Status == TestExecutionStatus.Completed || e.Status == TestExecutionStatus.OOSOpen);
        items.Add(new ChecklistItem("AllTestsComplete", allDone,
            allDone ? $"All {executions.Count} test execution(s) completed"
                    : $"{executions.Count(e => e.Status != TestExecutionStatus.Completed && e.Status != TestExecutionStatus.OOSOpen)} execution(s) still in progress"));

        // Check 2: No open OOS investigations
        var openOos = await _db.OosInvestigations
            .CountAsync(o => executions.Select(e => e.ExecutionId).Contains(o.ExecutionId) && o.Status == OosStatus.Open);
        items.Add(new ChecklistItem("NoOpenOOS", openOos == 0,
            openOos == 0 ? "No open OOS investigations" : $"{openOos} open OOS investigation(s) require closure"));

        // Check 3: CoA approved
        var coaApproved = await _db.Coas.AnyAsync(c => c.SampleId == sampleId && c.Status == CoaStatus.Released);
        items.Add(new ChecklistItem("CoAApproved", coaApproved,
            coaApproved ? "Certificate of Analysis approved" : "No approved CoA found for this sample"));

        // Check 4: No open CAPA linked to this sample
        var openCapa = await _db.ComplaintsDeviations
            .CountAsync(c => c.SampleId == sampleId && c.Status == "Open" && c.CdType == CdType.Capa);
        items.Add(new ChecklistItem("NoOpenCapa", openCapa == 0,
            openCapa == 0 ? "No open CAPA linked to sample" : $"{openCapa} open CAPA action(s) pending"));

        // Check 5: All logbook entries signed
        var unsignedEntries = await _db.DigitalLogbookEntries
            .CountAsync(e => e.SampleId == sampleId && e.Status == LogbookEntryStatus.Pending);
        items.Add(new ChecklistItem("LogbookSigned", unsignedEntries == 0,
            unsignedEntries == 0 ? "All logbook entries signed" : $"{unsignedEntries} unsigned logbook entry/entries"));

        return items;
    }
}

internal record ChecklistItem(string CheckType, bool Passed, string Detail);

public record InitiateBatchReleaseRequest(int SampleId);
public record BatchReleaseDecisionRequest(string Decision, string DecisionReason, string Password, string Meaning, string Reason);


