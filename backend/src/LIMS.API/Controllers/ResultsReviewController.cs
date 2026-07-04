using LIMS.API.Pdf;
using LIMS.Application.Features.ResultsReview;
using LIMS.Domain.Entities;
using LIMS.Application.Interfaces;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QuestPDF.Fluent;
using QuestPDF.Infrastructure;
using Microsoft.Extensions.Logging;

namespace LIMS.API.Controllers;

[ApiController]
[Route("api/v1/results-review")]
[Authorize]
public class ResultsReviewController : LimsControllerBase
{
    private readonly IMediator _mediator;
    private readonly ILimsDbContext _db;
    private readonly ILogger<ResultsReviewController> _log;
    public ResultsReviewController(IMediator mediator, ILimsDbContext db, ILogger<ResultsReviewController> log)
    { _mediator = mediator; _db = db; _log = log; }

    // POST api/v1/results-review/{executionId}/peer-review � 2nd analyst §11.50 e-sig (FR-02, FR-03)
    [HttpPost("{executionId}/peer-review")]
    [Authorize(Roles = "Admin,Analyst,LabManager,QA,QCLead")]
    public async Task<IActionResult> PeerReview(int executionId, [FromBody] ReviewRequest request)
    {
        int reviewerId;
        if (!string.IsNullOrWhiteSpace(request.ReviewerUsername))
        {
            // Reviewer is a different person � resolve by username
            var reviewer = await _db.Users
                .FirstOrDefaultAsync(u => u.Username.ToLower() == request.ReviewerUsername.ToLower() && u.IsActive);
            if (reviewer is null)
                return BadRequest(new { error = "USER_NOT_FOUND", message = $"User '{request.ReviewerUsername}' not found or inactive." });
            reviewerId = reviewer.UserId;
        }
        else
        {
            if (!TryGetUserId(out reviewerId)) return Unauthorized(new { error = "Invalid token claims." });
        }
        var result = await _mediator.Send(new PeerReviewCommand(
            executionId, reviewerId, request.Password, request.Meaning, request.Reason, request.Notes));
        if (!result.IsSuccess)
        {
            if (result.ErrorCode == "ESIGN_AUTH_FAILED") return Unauthorized(new { error = result.ErrorCode, message = result.ErrorMessage });
            return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        }
        return Ok(new { reviewId = result.Value, reviewType = "PeerReview" });
    }

    // POST api/v1/results-review/{executionId}/qc-lead-verify � QC Lead §11.50 e-sig + OOS gate (FR-04, FR-07)
    [HttpPost("{executionId}/qc-lead-verify")]
    [Authorize(Roles = "Admin,QA,LabManager,QCLead")]
    public async Task<IActionResult> QCLeadVerify(int executionId, [FromBody] ReviewRequest request)
    {
        int qcLeadId;
        if (!string.IsNullOrWhiteSpace(request.ReviewerUsername))
        {
            var reviewer = await _db.Users
                .FirstOrDefaultAsync(u => u.Username.ToLower() == request.ReviewerUsername.ToLower() && u.IsActive);
            if (reviewer is null)
                return BadRequest(new { error = "USER_NOT_FOUND", message = $"User '{request.ReviewerUsername}' not found or inactive." });
            qcLeadId = reviewer.UserId;
        }
        else
        {
            if (!TryGetUserId(out qcLeadId)) return Unauthorized(new { error = "Invalid token claims." });
        }
        var result = await _mediator.Send(new QCLeadVerifyCommand(
            executionId, qcLeadId, request.Password, request.Meaning, request.Reason, request.Notes));
        if (!result.IsSuccess)
        {
            if (result.ErrorCode == "ESIGN_AUTH_FAILED") return Unauthorized(new { error = result.ErrorCode, message = result.ErrorMessage });
            return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        }
        return Ok(new { reviewId = result.Value, reviewType = "QCLeadVerification" });
    }

    // GET api/v1/results-review/{executionId}/pdf � Batch Analysis Summary PDF
    [HttpGet("{executionId}/pdf")]
    public async Task<IActionResult> GetPdf(int executionId)
    {
        TestExecution? exec;
        try
        {
            exec = await _db.TestExecutions
                .Include(e => e.Sample).ThenInclude(s => s.Material)
                // Note: Sample.Lab excluded — Lab FK may not match a valid laboratory row
                // (seeded samples use LabId=1 which may not exist). LabName falls back to "—".
                .Include(e => e.Analyst)
                .Include(e => e.Instrument)
                .Include(e => e.LogbookEntries).ThenInclude(le => le.Parameter)
                .Include(e => e.ResultsReviews).ThenInclude(r => r.Reviewer)
                .Include(e => e.ResultsReviews).ThenInclude(r => r.Signature)
                .Include(e => e.OosInvestigations)
                .FirstOrDefaultAsync(e => e.ExecutionId == executionId);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "PDF query failed for ExecutionId={ExecutionId}", executionId);
            return StatusCode(500, new { error = "QUERY_FAILED", executionId, message = ex.Message, inner = ex.InnerException?.Message });
        }

        if (exec is null)
        {
            _log.LogWarning("PDF requested for ExecutionId={ExecutionId} but not found in DB", executionId);
            return NotFound(new { error = "EXECUTION_NOT_FOUND", executionId, message = $"TestExecution {executionId} not found in database." });
        }

        var data = new BatchAnalysisPdfDocument.BatchAnalysisData(
            ExecutionId:   exec.ExecutionId,
            SampleNumber:  exec.Sample?.SampleNumber ?? "",
            MaterialName:  exec.Sample?.Material?.MaterialName ?? "�",
            LotNumber:     exec.Sample?.LotNumber ?? "",
            LabName:       exec.Sample?.Lab?.LabName ?? "—",
            AnalystName:   exec.Analyst?.FullName ?? "Unknown",
            InstrumentCode: exec.Instrument?.InstrumentCode ?? "�",
            InstrumentType: exec.Instrument?.InstrumentType ?? "�",
            Status:        exec.Status.ToString(),
            StartedAt:     exec.StartedAt,
            CompletedAt:   exec.CompletedAt,
            Results: exec.LogbookEntries.Select(le => new BatchAnalysisPdfDocument.TestResultRow(
                le.Parameter?.ParameterName ?? "�",
                le.RawValue,
                le.CalculatedResult,
                le.SpecMinSnapshot,
                le.SpecMaxSnapshot,
                le.PassFail,
                le.IsOos,
                le.IsOot
            )).ToList(),
            Reviews: exec.ResultsReviews.Select(r => new BatchAnalysisPdfDocument.ReviewRow(
                r.ReviewType.ToString(),
                r.Reviewer?.FullName ?? "�",
                r.ReviewedAt,
                r.Notes
            )).ToList(),
            OosCount: exec.OosInvestigations.Count(o => o.FlagType.ToString() == "OOS"),
            OotCount: exec.OosInvestigations.Count(o => o.FlagType.ToString() == "OOT")
        );

        try
        {
            QuestPDF.Settings.License = LicenseType.Community;
            var doc   = new BatchAnalysisPdfDocument(data);
            var bytes = doc.GeneratePdf();
            var fname = $"BatchAnalysis_{exec.ExecutionId:D5}_{exec.Sample?.SampleNumber ?? "unknown"}.pdf";
            return File(bytes, "application/pdf", fname);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "PDF generation failed for ExecutionId={ExecutionId}", executionId);
            return StatusCode(500, new { error = "PDF_GENERATION_FAILED", message = ex.Message });
        }
    }

    // POST api/v1/results-review/evidence � FR-14: attach evidence file reference (audit-logged)
    [HttpPost("evidence")]
    [Authorize(Roles = "Admin,Analyst,LabManager,QA,QCLead")]
    public async Task<IActionResult> AttachEvidence([FromBody] AttachEvidenceRequest request)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized(new { error = "Invalid token claims." });

        var entryExists = await _db.DigitalLogbookEntries.AnyAsync(e => e.EntryId == request.EntryId);
        if (!entryExists) return NotFound(new { error = "ENTRY_NOT_FOUND", message = "Logbook entry not found." });

        var evidence = new ResultEvidence
        {
            EntryId      = request.EntryId,
            SampleId     = request.SampleId,
            FileRef      = request.FileRef,
            Description  = request.Description,
            UploadedById = userId,
            UploadedAt   = DateTimeOffset.UtcNow
        };
        _db.ResultEvidences.Add(evidence);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(AttachEvidence), new { id = evidence.EvidenceId },
            new { evidenceId = evidence.EvidenceId });
    }
}

public record ReviewRequest(string Password, string Meaning, string Reason, string? Notes = null, string? ReviewerUsername = null);
public record AttachEvidenceRequest(int EntryId, int SampleId, string FileRef, string? Description = null);


