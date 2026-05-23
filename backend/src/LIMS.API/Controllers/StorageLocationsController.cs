using LIMS.Application.Features.SampleInventory;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LIMS.API.Controllers;

[ApiController]
[Route("api/v1/storage-locations")]
[Authorize]
public class StorageLocationsController : ControllerBase
{
    private readonly IMediator _mediator;
    public StorageLocationsController(IMediator mediator) { _mediator = mediator; }

    // GET api/v1/storage-locations?labId=1
    // FR-10: storage location master — real-time inventory via vw_storage_inventory (Contract 2)
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] int? labId)
        => Ok(await _mediator.Send(new GetStorageLocationsQuery(labId)));

    // POST api/v1/storage-locations
    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Create([FromBody] CreateStorageLocationRequest request)
    {
        var result = await _mediator.Send(new CreateStorageLocationCommand(
            request.LabId, request.LocationCode, request.LocationName, request.LocationType,
            request.TempMinC, request.TempMaxC, request.HumidityMinPct, request.HumidityMaxPct,
            request.LowStockThreshold));
        if (!result.IsSuccess) return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return CreatedAtAction(nameof(GetAll), new { id = result.Value }, new { locationId = result.Value });
    }

    // PUT api/v1/storage-locations/{id}
    [HttpPut("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateStorageLocationRequest request)
    {
        var result = await _mediator.Send(new UpdateStorageLocationCommand(
            id, request.LocationName, request.LocationType,
            request.TempMinC, request.TempMaxC, request.HumidityMinPct, request.HumidityMaxPct,
            request.LowStockThreshold));
        if (!result.IsSuccess) return result.ErrorCode == "NOT_FOUND" ? NotFound() : BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return Ok(new { locationId = result.Value });
    }

    // POST api/v1/storage-locations/transfers
    // FR-12: INSERT-only location transfer log (21 CFR 211.170 chain of custody)
    [HttpPost("transfers")]
    public async Task<IActionResult> Transfer([FromBody] TransferSampleRequest request)
    {
        var username = User.Identity?.Name ?? "Unknown";
        var result = await _mediator.Send(new TransferSampleCommand(
            request.SampleId, request.FromLocationId, request.ToLocationId,
            username, request.Reason));
        if (!result.IsSuccess) return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return Ok(new { transferId = result.Value });
    }
}

// GET api/v1/condition-excursions?locationId=…  (all locations or filtered)
[ApiController]
[Route("api/v1/condition-excursions")]
[Authorize]
public class AllConditionExcursionsController : ControllerBase
{
    private readonly IMediator _mediator;
    public AllConditionExcursionsController(IMediator mediator) { _mediator = mediator; }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] int? locationId)
        => Ok(await _mediator.Send(new GetConditionExcursionsQuery(locationId)));
}

// POST api/v1/storage-locations/{locationId}/excursions
// FR-13: log condition excursion — ExcursionImpactService triggered server-side (Contract 1)
[ApiController]
[Route("api/v1/storage-locations/{locationId:int}/excursions")]
[Authorize]
public class ConditionExcursionsController : ControllerBase
{
    private readonly IMediator _mediator;
    public ConditionExcursionsController(IMediator mediator) { _mediator = mediator; }

    // GET api/v1/storage-locations/{locationId}/excursions
    [HttpGet]
    public async Task<IActionResult> GetExcursions(int locationId)
        => Ok(await _mediator.Send(new GetConditionExcursionsQuery(locationId)));

    [HttpPost]
    public async Task<IActionResult> LogExcursion(int locationId, [FromBody] LogExcursionRequest request)
    {
        var username = User.Identity?.Name ?? "Unknown";
        var result = await _mediator.Send(new LogConditionExcursionCommand(
            locationId, request.ExcursionType, request.MeasuredValue,
            request.LimitExceeded, request.ExcursionStart, request.ExcursionEnd, username));
        if (!result.IsSuccess) return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return Ok(new { excursionId = result.Value });
    }

    [HttpPut("{excursionId:int}/impact")]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> CompleteImpact(int locationId, int excursionId, [FromBody] CompleteImpactRequest request)
    {
        var result = await _mediator.Send(new CompleteExcursionImpactCommand(excursionId, request.ImpactOutcome));
        if (!result.IsSuccess) return result.ErrorCode == "NOT_FOUND" ? NotFound() : BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return Ok(new { excursionId = result.Value, impactAssessed = true });
    }
}

public record CreateStorageLocationRequest(
    int LabId, string LocationCode, string LocationName, string LocationType,
    decimal? TempMinC, decimal? TempMaxC,
    decimal? HumidityMinPct, decimal? HumidityMaxPct,
    int? LowStockThreshold);

public record UpdateStorageLocationRequest(
    string LocationName, string LocationType,
    decimal? TempMinC, decimal? TempMaxC,
    decimal? HumidityMinPct, decimal? HumidityMaxPct,
    int? LowStockThreshold);

public record TransferSampleRequest(
    int SampleId, int FromLocationId, int ToLocationId, string? Reason);

public record LogExcursionRequest(
    string ExcursionType, decimal MeasuredValue, string LimitExceeded,
    DateTimeOffset ExcursionStart, DateTimeOffset? ExcursionEnd);

public record CompleteImpactRequest(string ImpactOutcome);
