using LIMS.Application.Features.MasterData.Parameters;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LIMS.API.Controllers;

[ApiController]
[Route("api/v1/lookup-tables")]
[Authorize]
public class LookupTablesController : ControllerBase
{
    private readonly IMediator _mediator;
    public LookupTablesController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<IActionResult> GetAll()
        => Ok(await _mediator.Send(new GetLookupTablesQuery()));

    [HttpPost]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> Create([FromBody] CreateLookupTableRequest request)
    {
        var username = User.Identity?.Name ?? "Unknown";
        var result = await _mediator.Send(new CreateLookupTableCommand(request.LookupCode, request.InputCol1, request.InputCol2, request.ResultCol, username));
        if (!result.IsSuccess) return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return CreatedAtAction(nameof(GetAll), new { id = result.Value }, new { lookupTableId = result.Value });
    }

    // POST api/v1/lookup-tables/{id}/rows
    [HttpPost("{id}/rows")]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> AddRow(int id, [FromBody] AddLookupRowRequest request)
    {
        var result = await _mediator.Send(new AddLookupRowCommand(id, request.InputValue1, request.InputValue2, request.ResultValue));
        if (!result.IsSuccess) return result.ErrorCode == "NOT_FOUND" ? NotFound() : BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return Ok(new { rowId = result.Value });
    }

    // DELETE api/v1/lookup-tables/{id}/rows/{rowId}
    [HttpDelete("{id}/rows/{rowId:int}")]
    [Authorize(Roles = "Admin,QA")]
    public async Task<IActionResult> DeleteRow(int id, int rowId)
    {
        var result = await _mediator.Send(new DeleteLookupRowCommand(rowId));
        if (!result.IsSuccess) return result.ErrorCode == "NOT_FOUND" ? NotFound() : BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return Ok(new { rowId = result.Value });
    }
}

public record CreateLookupTableRequest(string LookupCode, string InputCol1, string? InputCol2, string ResultCol);
public record AddLookupRowRequest(decimal InputValue1, decimal? InputValue2, decimal ResultValue);
