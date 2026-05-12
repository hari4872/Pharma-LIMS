using LIMS.Application.Features.MasterData.Audit;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LIMS.API.Controllers;

[ApiController]
[Route("api/v1/audit")]
[Authorize]
public class AuditController : ControllerBase
{
    private readonly IMediator _mediator;
    public AuditController(IMediator mediator) => _mediator = mediator;

    // GET api/v1/audit/{entity}/{id}  — 21 CFR §11.10(e) audit trail
    [HttpGet("{entity}/{id:int}")]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> GetAuditTrail(string entity, int id)
        => Ok(await _mediator.Send(new GetAuditLogsQuery(entity, id)));
}
