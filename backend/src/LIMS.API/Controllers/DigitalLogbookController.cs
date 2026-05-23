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

    // GET api/v1/digital-logbook/export?format=csv — FR-09: export with all §11.50 manifestations
    [HttpGet("export")]
    [Authorize(Roles = "QA,QCLead,Admin")]
    public async Task<IActionResult> Export(
        [FromQuery] int? sampleId, [FromQuery] int? executionId, [FromQuery] int? labId,
        [FromQuery] string? status,
        [FromQuery] DateTimeOffset? dateFrom, [FromQuery] DateTimeOffset? dateTo,
        [FromQuery] string format = "csv")
    {
        var entries = await _mediator.Send(new GetLogbookEntriesQuery(sampleId, executionId, labId, status, dateFrom, dateTo));

        // Build CSV with all §11.50 audit columns
        var lines = new System.Text.StringBuilder();
        lines.AppendLine("EntryId,SampleNumber,ParameterName,RawValue,CalculatedResult,PassFail,IsOos,IsOot,SpecMin,SpecMax,AnalystName,SignedBy,SignedAt,TriggerSource,Status,InstrumentName,EvidenceFileRef");
        foreach (var e in entries)
        {
            lines.AppendLine($"{e.EntryId},{e.SampleNumber},{e.ParameterName}," +
                $"{e.RawValue},{e.CalculatedResult},{e.PassFail},{e.IsOos},{e.IsOot}," +
                $"{e.SpecMinSnapshot},{e.SpecMaxSnapshot}," +
                $"{e.AnalystName},{e.SignedByFullName},{e.SignedAt},{e.TriggerSource},{e.Status},{e.InstrumentName},{e.EvidenceFileRef}");
        }

        var bytes = System.Text.Encoding.UTF8.GetBytes(lines.ToString());
        var fileName = $"DigitalLogbook_{DateTimeOffset.UtcNow:yyyyMMdd_HHmmss}.csv";
        return File(bytes, "text/csv", fileName);
    }
}
