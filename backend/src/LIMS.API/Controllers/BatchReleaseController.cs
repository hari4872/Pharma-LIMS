using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LIMS.API.Controllers;

/// <summary>
/// Sprint 7 � Batch Release Workflow
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
                sampleNumber    = r.Sample != null ? r.Sample.SampleNumber : "",
                materialName    = r.Sample != null && r.Sample.Material != null ? r.Sample.Material.MaterialName : "Unknown",
                lotNumber       = r.Sample != null ? r.Sample.LotNumber : "",
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

    // POST api/v1/batch-releases � initiate review for a sample
    [HttpPost]
    [Authorize(Roles = "Admin,QA,LabManager")]
    public async Task<IActionResult> Initiate([FromBody] InitiateBatchReleaseRequest req)
    {
        var sample = await _db.Samples
            .Include(s => s.Material)
            .FirstOrDefaultAsync(s => s.SampleId == req.SampleId);
        if (sample is null) return NotFound(new { error = "Sample not found." });

        if (sample.Status != SampleStatus.PendingQAReview && sample.Status != SampleStatus.Released)
            return BadRequest(new { error = $"Sample must be in PendingQAReview or Released status. Current: {sample.Status}" });

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

    // POST api/v1/batch-releases/{id}/decide � QA final release/reject/hold with §11.50 e-sig
    [HttpPost("{id}/decide")]
    [Authorize(Roles = "Admin,QA,LabManager")]
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

        // §11.50 e-signature required for batch release decision (21 CFR 211.192)
        var sig = await _esig.CreateSignatureAsync(
            userId, req.Password, req.Meaning, req.Reason,
            "BatchRelease.Decision", default);
        if (sig is null)
            return Unauthorized(new { error = "ESIGN_AUTH_FAILED", message = "Password incorrect � e-signature rejected. (21 CFR §11.300)" });

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

        // Audit log � 21 CFR �11.10(e): INSERT-only record of batch release decision
        var userName = User.Identity?.Name ?? "Unknown";
        await _db.MasterDataAuditLogs.AddAsync(new LIMS.Domain.Entities.MasterDataAuditLog
        {
            EntityType  = "BatchRelease",
            EntityId    = id,
            EventType   = "Decision",
            OldValue    = System.Text.Json.JsonSerializer.Serialize(new { Status = "InReview" }),
            NewValue    = System.Text.Json.JsonSerializer.Serialize(new {
                Status        = req.Decision,
                Decision      = req.Decision,
                DecisionReason= req.DecisionReason,
                SignatureId   = sig.SignatureId,
                SampleId      = release.SampleId,
                SampleNumber  = release.Sample.SampleNumber
            }),
            PerformedBy = userName,
            PerformedAt = DateTimeOffset.UtcNow
        });
        await _db.SaveChangesAsync();

        // Push to LabManager + AllUsers
        await _notify.PushToGroupAsync("LabManager", "BatchDecision",
            new { releaseId = id, sampleNumber = release.Sample.SampleNumber, decision = req.Decision }, default);

        return Ok(new { release.BatchReleaseId, decision = req.Decision, sampleStatus = release.Sample.Status.ToString() });
    }

    // GET api/v1/batch-releases/{id}/risk-score
    [HttpGet("{id}/risk-score")]
    public async Task<IActionResult> GetRiskScore(int id)
    {
        var release = await _db.BatchReleases
            .FirstOrDefaultAsync(r => r.BatchReleaseId == id);
        if (release is null) return NotFound();

        var sampleId = release.SampleId;
        var today    = DateOnly.FromDateTime(DateTime.UtcNow);

        // 1. OOS count
        var oosCount = await _db.DigitalLogbookEntries
            .CountAsync(e => e.SampleId == sampleId && e.IsOos);

        // 2. OOT count
        var ootCount = await _db.DigitalLogbookEntries
            .CountAsync(e => e.SampleId == sampleId && e.IsOot);

        // 3. Retest count � executions beyond the first are retests
        var executionCount = await _db.TestExecutions
            .CountAsync(e => e.SampleId == sampleId);
        var retestCount = Math.Max(0, executionCount - 1);

        // 4. Open CAPA count linked to this sample
        var openCapaCount = await _db.ComplaintsDeviations
            .CountAsync(c => c.SampleId == sampleId &&
                             c.CdType == CdType.Capa &&
                             c.Status != "Closed");

        // 5. Analyst training expiring within 30 days
        var expiryThreshold = today.AddDays(30);
        var analystIds = await _db.TestExecutions
            .Where(e => e.SampleId == sampleId && e.AnalystId != null)
            .Select(e => e.AnalystId!.Value)
            .Distinct()
            .ToListAsync();

        bool trainingExpirySoon = analystIds.Any() && await _db.UserTrainingRecords
            .AnyAsync(r => analystIds.Contains(r.UserId) &&
                           r.ValidUntil.HasValue &&
                           r.ValidUntil.Value <= expiryThreshold &&
                           r.ValidUntil.Value >= today);

        // 6. Instrument calibration due within 14 days
        var calibThreshold = today.AddDays(14);
        var instrumentIds = await _db.TestExecutions
            .Where(e => e.SampleId == sampleId && e.InstrumentId != null)
            .Select(e => e.InstrumentId!.Value)
            .Distinct()
            .ToListAsync();

        bool instrumentCalibrationSoon = instrumentIds.Any() && await _db.Instruments
            .AnyAsync(i => instrumentIds.Contains(i.InstrumentId) &&
                           i.CalibrationDue <= calibThreshold);

        // -- Scoring --------------------------------------------------------
        int score = 0;
        var factors = new List<object>();

        if (oosCount > 0)
        {
            score += 40;
            if (oosCount > 2) score += 20;
            factors.Add(new { factor = "OOS results", count = oosCount, impact = "High" });
        }
        if (ootCount > 0)
        {
            score += 15;
            factors.Add(new { factor = "OOT results", count = ootCount, impact = "Medium" });
        }
        if (retestCount > 1)
        {
            score += 10;
            factors.Add(new { factor = "Retest performed", count = retestCount, impact = "Medium" });
        }
        if (openCapaCount > 0)
        {
            score += 15;
            factors.Add(new { factor = "Open CAPA actions", count = openCapaCount, impact = "High" });
        }
        if (trainingExpirySoon)
        {
            score += 10;
            factors.Add(new { factor = "Analyst training expiring soon", count = 1, impact = "Medium" });
        }
        if (instrumentCalibrationSoon)
        {
            score += 10;
            factors.Add(new { factor = "Instrument calibration due soon", count = 1, impact = "Medium" });
        }

        var riskLevel = score >= 60 ? "Critical"
                      : score >= 40 ? "High"
                      : score >= 20 ? "Medium"
                      : "Low";

        var recommendation = riskLevel switch
        {
            "Critical" => "Multiple OOS results � full re-investigation required before release",
            "High"     => "Review OOS/OOT findings and retest justification before approving",
            "Medium"   => "Verify retest rationale and check analyst/instrument compliance",
            _          => "Standard QA review � no major risk factors identified",
        };

        return Ok(new { riskLevel, score, factors, recommendation });
    }

    // -- Private Helpers --------------------------------------------------------

    private async Task<List<ChecklistItem>> EvaluateChecklistAsync(int sampleId)
    {
        var items = new List<ChecklistItem>();

        // Check 1: All test executions completed
        var executions = await _db.TestExecutions
            .Where(e => e.SampleId == sampleId)
            .ToListAsync();
        bool allDone = executions.Any() &&
                       executions.All(e => e.Status == TestExecutionStatus.Completed ||
                                           e.Status == TestExecutionStatus.QCVerified ||
                                           e.Status == TestExecutionStatus.OOSOpen);
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


