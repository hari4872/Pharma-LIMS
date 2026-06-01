using LIMS.Application.Features.Traceability;
using LIMS.Application.Interfaces;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LIMS.API.Controllers;

[ApiController]
[Route("api/v1/traceability")]
[Authorize]
public class TraceabilityController : LimsControllerBase
{
    private readonly IMediator _mediator;
    private readonly ILimsDbContext _db;
    public TraceabilityController(IMediator mediator, ILimsDbContext db)
    { _mediator = mediator; _db = db; }

    // GET api/v1/traceability/samples/lookup?q=SMPL-2026-0001  (or numeric ID)
    // Allows the frontend to resolve a sample number string to a sample ID
    [HttpGet("samples/lookup")]
    public async Task<IActionResult> LookupSampleId([FromQuery] string q)
    {
        if (string.IsNullOrWhiteSpace(q))
            return BadRequest(new { error = "Query parameter 'q' is required." });

        // Accept either a numeric ID or a sample number string
        if (int.TryParse(q.Trim(), out var numericId))
        {
            var byId = await _db.Samples
                .Include(s => s.Material)
                .Include(s => s.SampleTypeNav)
                .FirstOrDefaultAsync(s => s.SampleId == numericId);
            if (byId is null) return NotFound(new { error = $"Sample #{numericId} not found." });
            return Ok(new {
                byId.SampleId, byId.SampleNumber, byId.LotNumber,
                MaterialName = byId.Material.MaterialName,
                SampleTypeName = byId.SampleTypeNav != null ? byId.SampleTypeNav.TypeName : "Unknown",
                Status = byId.Status.ToString(), byId.CreatedAt
            });
        }
        else
        {
            var byNumber = await _db.Samples
                .Include(s => s.Material)
                .Include(s => s.SampleTypeNav)
                .FirstOrDefaultAsync(s => s.SampleNumber == q.Trim());
            if (byNumber is null) return NotFound(new { error = $"Sample '{q}' not found." });
            return Ok(new {
                byNumber.SampleId, byNumber.SampleNumber, byNumber.LotNumber,
                MaterialName = byNumber.Material.MaterialName,
                SampleTypeName = byNumber.SampleTypeNav != null ? byNumber.SampleTypeNav.TypeName : "Unknown",
                Status = byNumber.Status.ToString(), byNumber.CreatedAt
            });
        }
    }

    // GET api/v1/traceability/samples/{sampleId}/graph
    // FR-01..FR-03, FR-08, FR-09: full bidirectional traceability graph
    [HttpGet("samples/{sampleId:int}/graph")]
    public async Task<IActionResult> GetGraph(int sampleId)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized(new { error = "Invalid token claims." });
        var result = await _mediator.Send(new GetTraceabilityGraphQuery(sampleId, userId));
        if (!result.IsSuccess) return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return Ok(result.Value);
    }

    // GET api/v1/traceability/recall?lotNumber=LOT001
    // FR-12: recall scope query â€” all affected downstream batches from lot node
    [HttpGet("recall")]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> GetRecallScope(
        [FromQuery] string lotNumber,
        [FromQuery] string? batch,
        [FromQuery] DateTimeOffset? dateFrom,
        [FromQuery] DateTimeOffset? dateTo,
        [FromQuery] int? analystId,
        [FromQuery] int? instrumentId)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized(new { error = "Invalid token claims." });
        var result = await _mediator.Send(new GetRecallScopeQuery(lotNumber, userId, batch, dateFrom, dateTo, analystId, instrumentId));
        if (!result.IsSuccess) return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });

        // Enrich: return full sample objects instead of just IDs for LabVantage-parity recall table
        var ids = result.Value ?? new List<int>();
        var samples = await _db.Samples
            .Include(s => s.Material)
            .Where(s => ids.Contains(s.SampleId))
            .OrderBy(s => s.SampleId)
            .Select(s => new {
                s.SampleId, s.SampleNumber,
                MaterialName = s.Material.MaterialName,
                s.LotNumber,
                Status = s.Status.ToString(),
                s.CreatedAt, s.DueDate, s.IsRush
            })
            .ToListAsync();

        return Ok(new { lotNumber, affectedSamples = samples, count = samples.Count });
    }

    // POST api/v1/traceability/sampling-events
    // FR-09: log sampling event (upstream traceability node)
    [HttpPost("sampling-events")]
    public async Task<IActionResult> LogSamplingEvent([FromBody] LogSamplingEventRequest request)
    {
        var result = await _mediator.Send(new LogSamplingEventCommand(
            request.SampleId, request.SampledById, request.SampledAt,
            request.Location, request.QuantityTaken, request.QuantityUom,
            request.ContainerId, request.Notes));
        if (!result.IsSuccess) return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return CreatedAtAction(nameof(GetGraph), new { sampleId = request.SampleId }, new { samplingEventId = result.Value });
    }

    // GET api/v1/traceability/complaints-deviations?sampleId=5
    [HttpGet("complaints-deviations")]
    public async Task<IActionResult> ListComplaintsDeviations([FromQuery] int? sampleId)
    {
        var q = _db.ComplaintsDeviations.AsQueryable();
        if (sampleId.HasValue) q = q.Where(x => x.SampleId == sampleId.Value);
        var list = await q.OrderByDescending(x => x.OpenedAt)
            .Select(x => new {
                x.CdId, x.SampleId,
                CdType    = x.CdType.ToString(),
                x.CdReference, x.Description,
                x.LinkedOosId, x.Status,
                CreatedAt = x.OpenedAt
            })
            .ToListAsync();
        return Ok(list);
    }

    // POST api/v1/traceability/complaints-deviations
    // FR-08: log complaint/deviation (downstream traceability node)
    [HttpPost("complaints-deviations")]
    [Authorize(Roles = "Admin,QA,QCLead")]
    public async Task<IActionResult> CreateComplaintsDeviation([FromBody] CreateCdRequest request)
    {
        var username = User.Identity?.Name ?? "Unknown";
        var result = await _mediator.Send(new CreateComplaintsDeviationCommand(
            request.SampleId, request.CdType, request.CdReference,
            request.Description, username, request.LinkedOosId));
        if (!result.IsSuccess) return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return CreatedAtAction(nameof(GetGraph), new { sampleId = request.SampleId }, new { cdId = result.Value });
    }

    // PUT api/v1/traceability/complaints-deviations/{id}/close
    // GET api/v1/traceability/samples/{id}/environment-log
    // Returns ProcessLog readings whose SlotTime falls within the sample's test execution window
    [HttpGet("samples/{id:int}/environment-log")]
    public async Task<IActionResult> GetEnvironmentLog(int id, CancellationToken ct)
    {
        // Find test window: earliest start to latest completion across all executions for this sample
        var executions = await _db.TestExecutions
            .Where(e => e.SampleId == id && e.StartedAt.HasValue)
            .ToListAsync(ct);

        if (!executions.Any())
            return Ok(new { sampleId = id, windowStart = (DateTimeOffset?)null, windowEnd = (DateTimeOffset?)null, rows = Array.Empty<object>() });

        var windowStart = executions.Min(e => e.StartedAt!.Value).AddHours(-1); // 1hr buffer before
        var windowEnd   = executions.Max(e => e.CompletedAt ?? DateTimeOffset.UtcNow).AddHours(1); // 1hr buffer after

        var rows = await _db.ProcessLogRows
            .Where(r => r.SlotTime >= windowStart && r.SlotTime <= windowEnd && r.Status == "Locked")
            .Include(r => r.Checkpoint)
            .Include(r => r.Readings).ThenInclude(rd => rd.Parameter)
            .OrderBy(r => r.SlotTime)
            .Select(r => new {
                r.RowId,
                r.SlotLabel,
                r.SlotTime,
                r.Status,
                CheckpointCode = r.Checkpoint.CheckpointCode,
                TriggerMode    = r.Checkpoint.TriggerMode.ToString(),
                Readings = r.Readings.Select(rd => new {
                    rd.ParameterId,
                    rd.Parameter.ParameterName,
                    Uom   = rd.Parameter.Uom,
                    rd.Value,
                    rd.RecordedBy,
                }).ToList(),
            })
            .ToListAsync(ct);

        return Ok(new { sampleId = id, windowStart, windowEnd, rows });
    }

    [HttpPut("complaints-deviations/{id:int}/close")]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> CloseComplaintsDeviation(int id)
    {
        var username = User.Identity?.Name ?? "Unknown";
        var result = await _mediator.Send(new CloseComplaintsDeviationCommand(id, username));
        if (!result.IsSuccess) return result.ErrorCode == "NOT_FOUND" ? NotFound() : BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return Ok(new { cdId = result.Value, status = "Closed" });
    }
}

public record LogSamplingEventRequest(
    int SampleId, int SampledById, DateTimeOffset SampledAt,
    string? Location, decimal? QuantityTaken, string? QuantityUom,
    string? ContainerId, string? Notes);

public record CreateCdRequest(
    int SampleId, string CdType, string CdReference,
    string? Description, int? LinkedOosId);

