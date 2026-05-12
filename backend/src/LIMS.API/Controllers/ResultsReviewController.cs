using LIMS.Application.Features.ResultsReview;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LIMS.API.Controllers;

[ApiController]
[Route("api/v1/results-review")]
[Authorize]
public class ResultsReviewController : ControllerBase
{
    private readonly IMediator _mediator;
    public ResultsReviewController(IMediator mediator) => _mediator = mediator;

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
}

public record ReviewRequest(string Password, string Meaning, string Reason, string? Notes = null);
