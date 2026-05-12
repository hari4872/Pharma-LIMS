using LIMS.Application.Features.DeliveryOrders;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LIMS.API.Controllers;

[ApiController]
[Route("api/v1/delivery-orders")]
[Authorize]
public class DeliveryOrdersController : ControllerBase
{
    private readonly IMediator _mediator;
    public DeliveryOrdersController(IMediator mediator) => _mediator = mediator;

    // GET api/v1/delivery-orders?status=
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? status)
    {
        var result = await _mediator.Send(new GetDeliveryOrdersQuery(status));
        return Ok(result);
    }

    // POST api/v1/delivery-orders — creates DO + auto-triggers DispatchQC task (DispatchEventService)
    [HttpPost]
    [Authorize(Roles = "Admin,QA,LabManager")]
    public async Task<IActionResult> Create([FromBody] CreateDORequest request)
    {
        var createdBy = User.Identity?.Name ?? "System";
        var result = await _mediator.Send(new CreateDeliveryOrderCommand(
            request.DoNumber, request.CustomerName, request.DespatchDate,
            request.PackingType, request.ProductId, createdBy));
        if (!result.IsSuccess) return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return Ok(new { doId = result.Value });
    }
}

public record CreateDORequest(
    string DoNumber,
    string? CustomerName,
    DateOnly? DespatchDate,
    string? PackingType,
    int ProductId);
