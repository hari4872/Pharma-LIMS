using LIMS.Application.Features.MasterData.Parameters;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LIMS.API.Controllers;

[ApiController]
[Route("api/v1/parameters")]
[Authorize]
public class ParametersController : ControllerBase
{
    private readonly IMediator _mediator;
    public ParametersController(IMediator mediator) => _mediator = mediator;

    // GET api/v1/parameters?methodId=1
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] int? methodId)
        => Ok(await _mediator.Send(new GetParametersQuery(methodId)));

    [HttpPost]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> Create([FromBody] CreateParameterRequest request)
    {
        var username = User.Identity?.Name ?? "Unknown";
        var result = await _mediator.Send(new CreateParameterCommand(
            request.MethodId, request.ParameterName, request.ParameterCode, request.Uom,
            request.DataType, request.FormulaType, request.CalcFormula, request.LookupTableId,
            request.InstrumentType, request.IsCritical, request.IsMandatory,
            request.ColumnFrequency, username));
        if (!result.IsSuccess) return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return CreatedAtAction(nameof(GetAll), new { id = result.Value }, new { parameterId = result.Value });
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateParameterRequest request)
    {
        var username = User.Identity?.Name ?? "Unknown";
        var result = await _mediator.Send(new UpdateParameterCommand(id, request.ParameterName, request.ParameterCode, request.Uom, request.DataType, request.FormulaType, request.CalcFormula, request.InstrumentType, request.IsCritical, request.IsMandatory, request.ColumnFrequency, username));
        if (!result.IsSuccess) return result.ErrorCode == "NOT_FOUND" ? NotFound() : BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return Ok(new { parameterId = result.Value });
    }
}

public record CreateParameterRequest(int MethodId, string ParameterName, string ParameterCode,
    string Uom, string DataType, string FormulaType, string? CalcFormula, int? LookupTableId,
    string? InstrumentType, bool IsCritical, bool IsMandatory, string? ColumnFrequency);

public record UpdateParameterRequest(string ParameterName, string ParameterCode,
    string Uom, string DataType, string FormulaType, string? CalcFormula,
    string? InstrumentType, bool IsCritical, bool IsMandatory, string? ColumnFrequency);
