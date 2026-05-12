using LIMS.Application.Features.DigitalLogbook;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LIMS.API.Controllers;

[ApiController]
[Route("api/v1/digital-logbook")]
[Authorize]
public class DigitalLogbookController : ControllerBase
{
    private readonly IMediator _mediator;
    public DigitalLogbookController(IMediator mediator) => _mediator = mediator;

    // GET api/v1/digital-logbook?sampleId=1&executionId=2&labId=3&status=Signed&dateFrom=...&dateTo=...
    [HttpGet]
    public async Task<IActionResult> GetEntries(
        [FromQuery] int? sampleId, [FromQuery] int? executionId, [FromQuery] int? labId,
        [FromQuery] string? status,
        [FromQuery] DateTimeOffset? dateFrom, [FromQuery] DateTimeOffset? dateTo)
        => Ok(await _mediator.Send(new GetLogbookEntriesQuery(sampleId, executionId, labId, status, dateFrom, dateTo)));
}
