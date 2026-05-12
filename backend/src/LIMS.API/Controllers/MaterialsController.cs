using LIMS.Application.Features.MasterData.Materials;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LIMS.API.Controllers;

[ApiController]
[Route("api/v1/materials")]
[Authorize]
public class MaterialsController : ControllerBase
{
    private readonly IMediator _mediator;
    public MaterialsController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? materialType, [FromQuery] bool includeInactive = false)
        => Ok(await _mediator.Send(new GetMaterialsQuery(materialType, includeInactive)));

    [HttpPost]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> Create([FromBody] CreateMaterialRequest request)
    {
        var username = User.Identity?.Name ?? "Unknown";
        var result = await _mediator.Send(new CreateMaterialCommand(request.MaterialName, request.Uom, request.MaterialType, request.ProductType, request.ShelfLifeDays, username));
        if (!result.IsSuccess) return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return CreatedAtAction(nameof(GetAll), new { id = result.Value }, new { materialId = result.Value });
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateMaterialRequest request)
    {
        var username = User.Identity?.Name ?? "Unknown";
        var result = await _mediator.Send(new UpdateMaterialCommand(id, request.MaterialName, request.Uom, request.MaterialType, request.ProductType, request.ShelfLifeDays, username));
        if (!result.IsSuccess) return result.ErrorCode == "NOT_FOUND" ? NotFound() : BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return Ok(new { materialId = result.Value });
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> Deactivate(int id, [FromBody] DeactivateRequest request)
    {
        var username = User.Identity?.Name ?? "Unknown";
        var result = await _mediator.Send(new DeactivateMaterialCommand(id, request.Reason, username));
        if (!result.IsSuccess) return result.ErrorCode == "NOT_FOUND" ? NotFound() : BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return Ok(new { materialId = result.Value, status = "Inactive" });
    }
}

public record CreateMaterialRequest(string MaterialName, string Uom, string MaterialType, string? ProductType, int ShelfLifeDays);
public record UpdateMaterialRequest(string MaterialName, string Uom, string MaterialType, string? ProductType, int ShelfLifeDays);
