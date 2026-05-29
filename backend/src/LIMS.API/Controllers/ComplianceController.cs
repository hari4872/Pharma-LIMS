using LIMS.Application.Features.Compliance;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LIMS.API.Controllers;

// FR-18/FR-20: Compliance & Governance â€” audit trail, signature log, periodic reviews
[ApiController]
[Route("api/v1/compliance")]
[Authorize(Roles = "QA,Admin")]
public class ComplianceController : LimsControllerBase
{
    private readonly IMediator _mediator;
    public ComplianceController(IMediator mediator) => _mediator = mediator;

    // GET api/v1/compliance/audit-trail?entityType=Sample&from=...&to=...&page=1&pageSize=50
    [HttpGet("audit-trail")]
    public async Task<IActionResult> GetAuditTrail(
        [FromQuery] int? labId,
        [FromQuery] string? entityType,
        [FromQuery] int? userId,
        [FromQuery] DateTimeOffset? from,
        [FromQuery] DateTimeOffset? to,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default)
        => Ok(await _mediator.Send(new GetAuditTrailQuery(labId, entityType, userId, from, to, page, pageSize), ct));

    // GET api/v1/compliance/signatures?userId=...&from=...&to=...
    [HttpGet("signatures")]
    public async Task<IActionResult> GetSignatureLog(
        [FromQuery] int? userId,
        [FromQuery] DateTimeOffset? from,
        [FromQuery] DateTimeOffset? to,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default)
        => Ok(await _mediator.Send(new GetSignatureLogQuery(userId, from, to, page, pageSize), ct));

    // GET api/v1/compliance/validation-reviews?reviewType=Annual&limitDays=365
    [HttpGet("validation-reviews")]
    public async Task<IActionResult> GetValidationReviews(
        [FromQuery] string? reviewType,
        [FromQuery] int? limitDays,
        CancellationToken ct = default)
        => Ok(await _mediator.Send(new GetValidationReviewsQuery(reviewType, limitDays), ct));

    // POST api/v1/compliance/validation-reviews â€” Â§11.50 e-sig
    [HttpPost("validation-reviews")]
    public async Task<IActionResult> RecordValidationReview([FromBody] RecordReviewRequest request, CancellationToken ct)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized(new { error = "Invalid token claims." });
        var result = await _mediator.Send(new RecordValidationReviewCommand(
            request.ReviewType, request.Outcome, request.Notes,
            userId, request.Password, request.Meaning, request.Reason), ct);
        return Ok(new { reviewId = result.ReviewId, nextReviewDue = result.NextReviewDue });
    }

    // GET api/v1/compliance/form-templates/pending-review
    [HttpGet("form-templates/pending-review")]
    public async Task<IActionResult> GetFormTemplatesPendingReview(CancellationToken ct)
        => Ok(await _mediator.Send(new GetFormTemplatesPendingReviewQuery(), ct));
}

public record RecordReviewRequest(string ReviewType, string Outcome, string? Notes, string Password, string Meaning, string Reason);

