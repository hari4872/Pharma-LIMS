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

namespace LIMS.API.Controllers;

[ApiController]
[Route("api/v1/results-review")]
[Authorize]
public class ResultsReviewController : LimsControllerBase
{
    private readonly IMediator _mediator;
    private readonly ILimsDbContext _db;
    public ResultsReviewController(IMediator mediator, ILimsDbContext db) { _mediator = mediator; _db = db; }

    // POST api/v1/results-review/{executionId}/peer-review â€” 2nd analyst Â§11.50 e-sig (FR-02, FR-03)
    [HttpPost("{executionId}/peer-review")]
    [Authorize(Roles = "Admin,Analyst,QCLead,QA")]
    public async Task<IActionResult> PeerReview(int executionId, [FromBody] ReviewRequest request)
    {
        if (!TryGetUserId(out var reviewerId)) return Unauthorized(new { error = "Invalid token claims." });
        var result = await _mediator.Send(new PeerReviewCommand(
            executionId, reviewerId, request.Password, request.Meaning, request.Reason, request.Notes));
        if (!result.IsSuccess)
        {
            if (result.ErrorCode == "ESIGN_AUTH_FAILED") return Unauthorized(new { error = result.ErrorCode, message = result.ErrorMessage });
            return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        }
        return Ok(new { reviewId = result.Value, reviewType = "PeerReview" });
    }

    // POST api/v1/results-review/{executionId}/qc-lead-verify â€” QC Lead Â§11.50 e-sig + OOS gate (FR-04, FR-07)
    [HttpPost("{executionId}/qc-lead-verify")]
    [Authorize(Roles = "QCLead,QA,Admin")]
    public async Task<IActionResult> QCLeadVerify(int executionId, [FromBody] ReviewRequest request)
    {
        if (!TryGetUserId(out var qcLeadId)) return Unauthorized(new { error = "Invalid token claims." });
        var result = await _mediator.Send(new QCLeadVerifyCommand(
            executionId, qcLeadId, request.Password, request.Meaning, request.Reason, request.Notes));
        if (!result.IsSuccess)
        {
            if (result.ErrorCode == "ESIGN_AUTH_FAILED") return Unauthorized(new { error = result.ErrorCode, message = result.ErrorMessage });
            return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        }
        return Ok(new { reviewId = result.Value, reviewType = "QCLeadVerification" });
    }

    // GET api/v1/results-review/{executionId}/pdf â€” Batch Analysis Summary PDF
    [HttpGet("{executionId}/pdf")]
    public async Task<IActionResult> GetPdf(int executionId)
    {
        var exec = await _db.TestExecutions
            .Include(e => e.Sample).ThenInclude(s => s.Material)
            .Include(e => e.Sample).ThenInclude(s => s.Lab)
            .Include(e => e.Analyst)
            .Include(e => e.Instrument)
            .Include(e => e.LogbookEntries).ThenInclude(le => le.Parameter)
            .Include(e => e.ResultsReviews).ThenInclude(r => r.Reviewer)
            .Include(e => e.ResultsReviews).ThenInclude(r => r.Signature)
            .Include(e => e.OosInvestigations)
            .FirstOrDefaultAsync(e => e.ExecutionId == executionId);

        if (exec is null) return NotFound();

        var data = new BatchAnalysisPdfDocument.BatchAnalysisData(
            ExecutionId:   exec.ExecutionId,
            SampleNumber:  exec.Sample.SampleNumber,
            MaterialName:  exec.Sample.Material?.MaterialName ?? "â€”",
            LotNumber:     exec.Sample.LotNumber,
            LabName:       exec.Sample.Lab?.LabName ?? "â€”",
            AnalystName:   exec.Analyst?.FullName ?? "Unknown",
            InstrumentCode: exec.Instrument?.InstrumentCode ?? "â€”",
            InstrumentType: exec.Instrument?.InstrumentType ?? "â€”",
            Status:        exec.Status.ToString(),
            StartedAt:     exec.StartedAt,
            CompletedAt:   exec.CompletedAt,
            Results: exec.LogbookEntries.Select(le => new BatchAnalysisPdfDocument.TestResultRow(
                le.Parameter?.ParameterName ?? "â€”",
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
                r.Reviewer?.FullName ?? "â€”",
                r.ReviewedAt,
                r.Notes
            )).ToList(),
            OosCount: exec.OosInvestigations.Count(o => o.FlagType.ToString() == "OOS"),
            OotCount: exec.OosInvestigations.Count(o => o.FlagType.ToString() == "OOT")
        );

        QuestPDF.Settings.License = LicenseType.Community;
        var doc   = new BatchAnalysisPdfDocument(data);
        var bytes = doc.GeneratePdf();
        var fname = $"BatchAnalysis_{exec.ExecutionId:D5}_{exec.Sample.SampleNumber}.pdf";
        return File(bytes, "application/pdf", fname);
    }

    // POST api/v1/results-review/evidence â€” FR-14: attach evidence file reference (audit-logged)
    [HttpPost("evidence")]
    [Authorize(Roles = "Admin,Analyst,QCLead,QA")]
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

public record ReviewRequest(string Password, string Meaning, string Reason, string? Notes = null);
public record AttachEvidenceRequest(int EntryId, int SampleId, string FileRef, string? Description = null);


