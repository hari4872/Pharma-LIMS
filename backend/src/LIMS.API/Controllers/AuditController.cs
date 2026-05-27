using LIMS.Application.Features.MasterData.Audit;
using LIMS.Application.Interfaces;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LIMS.API.Controllers;

[ApiController]
[Route("api/v1/audit")]
[Authorize]
public class AuditController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly ILimsDbContext _db;
    public AuditController(IMediator mediator, ILimsDbContext db) { _mediator = mediator; _db = db; }

    // GET api/v1/audit/{entity}/{id}  — 21 CFR §11.10(e) audit trail
    [HttpGet("{entity}/{id:int}")]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> GetAuditTrail(string entity, int id)
        => Ok(await _mediator.Send(new GetAuditLogsQuery(entity, id)));

    // GET api/v1/audit/login-history?userId=&from=&to=  — 21 CFR §11.10(d) login audit
    [HttpGet("login-history")]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> GetLoginHistory(
        [FromQuery] int? userId,
        [FromQuery] DateTimeOffset? from,
        [FromQuery] DateTimeOffset? to,
        [FromQuery] string? outcome)
    {
        var q = _db.LoginAuditLogs.AsQueryable();
        if (userId.HasValue)  q = q.Where(l => l.UserId == userId.Value);
        if (from.HasValue)    q = q.Where(l => l.AttemptedAt >= from.Value);
        if (to.HasValue)      q = q.Where(l => l.AttemptedAt <= to.Value);
        if (!string.IsNullOrWhiteSpace(outcome) &&
            Enum.TryParse<LIMS.Domain.Enums.LoginOutcome>(outcome, true, out var outcomeEnum))
            q = q.Where(l => l.Outcome == outcomeEnum);

        var logs = await q
            .OrderByDescending(l => l.AttemptedAt)
            .Take(1000)
            .Select(l => new {
                l.LoginAuditLogId, l.Username, l.UserId,
                l.IpAddress, l.UserAgent,
                Outcome = l.Outcome.ToString(),
                l.AttemptedAt
            })
            .ToListAsync();

        return Ok(logs);
    }
}
