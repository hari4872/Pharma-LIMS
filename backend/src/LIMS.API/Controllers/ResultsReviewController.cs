using LIMS.Application.Features.ResultsReview;
using LIMS.Domain.Entities;
using LIMS.Application.Interfaces;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LIMS.API.Controllers;

[ApiController]
[Route("api/v1/results-review")]
[Authorize]
public class ResultsReviewController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly ILimsDbContext _db;
    public ResultsReviewController(IMediator mediator, ILimsDbContext db) { _mediator = mediator; _db = db; }

    // POST api/v1/results-review/{executionId}/peer-review — 2nd analyst §11.50 e-sig (FR-02, FR-03)
    [HttpPost("{executionId}/peer-review")]
    [Authorize(Roles = "Analyst,QCLead,QA")]
    public async Task<IActionResult> PeerReview(int executionId, [FromBody] ReviewRequest request)
    {
        var reviewerId = int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "0");
        var result = await _mediator.Send(new PeerReviewCommand(
            executionId, reviewerId, request.Password, request.Meaning, request.Reason, request.Notes));
        if (!result.IsSuccess)
        {
            if (result.ErrorCode == "ESIGN_AUTH_FAILED") return Unauthorized(new { error = result.ErrorCode, message = result.ErrorMessage });
            return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        }
        return Ok(new { reviewId = result.Value, reviewType = "PeerReview" });
    }

    // POST api/v1/results-review/{executionId}/qc-lead-verify — QC Lead §11.50 e-sig + OOS gate (FR-04, FR-07)
    [HttpPost("{executionId}/qc-lead-verify")]
    [Authorize(Roles = "QCLead,QA,Admin")]
    public async Task<IActionResult> QCLeadVerify(int executionId, [FromBody] ReviewRequest request)
    {
        var qcLeadId = int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "0");
        var result = await _mediator.Send(new QCLeadVerifyCommand(
            executionId, qcLeadId, request.Password, request.Meaning, request.Reason, request.Notes));
        if (!result.IsSuccess)
        {
            if (result.ErrorCode == "ESIGN_AUTH_FAILED") return Unauthorized(new { error = result.ErrorCode, message = result.ErrorMessage });
            return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        }
        return Ok(new { reviewId = result.Value, reviewType = "QCLeadVerification" });
    }

    // POST api/v1/results-review/evidence — FR-14: attach evidence file reference (audit-logged)
    [HttpPost("evidence")]
    [Authorize(Roles = "Analyst,QCLead,QA")]
    public async Task<IActionResult> AttachEvidence([FromBody] AttachEvidenceRequest request)
    {
        var userId = int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "0");

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
