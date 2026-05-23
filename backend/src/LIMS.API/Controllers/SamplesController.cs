using LIMS.Application.Features.Samples;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LIMS.API.Controllers;

[ApiController]
[Route("api/v1/samples")]
[Authorize]
public class SamplesController : ControllerBase
{
    private readonly IMediator _mediator;
    public SamplesController(IMediator mediator) => _mediator = mediator;

    // GET api/v1/samples?labId=1&status=PendingTesting
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] int? labId, [FromQuery] string? status, [FromQuery] int? analystId)
        => Ok(await _mediator.Send(new GetSamplesQuery(labId, status, analystId)));

    // POST api/v1/samples — FR-01: unified entry for both manual and checkpoint auto-trigger
    [HttpPost]
    [Authorize(Roles = "Admin,QA,Analyst")]
    public async Task<IActionResult> Register([FromBody] RegisterSampleRequest request)
    {
        var username = User.Identity?.Name ?? "Unknown";
        var userId = int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "0");
        var result = await _mediator.Send(new RegisterSampleCommand(
            request.LabId, request.MaterialId, request.LotNumber,
            request.MfgDate, request.ExpDate, request.SampleTypeId,
            userId, username, request.CheckpointIds));
        if (!result.IsSuccess) return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return CreatedAtAction(nameof(GetAll), new { id = result.Value }, new { sampleId = result.Value });
    }

    // POST api/v1/samples/{id}/sign-srf — Step 7: SRF §11.50 e-sig → PendingTesting (FR-09)
    [HttpPost("{id}/sign-srf")]
    [Authorize(Roles = "Analyst,QA")]
    public async Task<IActionResult> SignSRF(int id, [FromBody] ApproveRequest request)
    {
        var userId = int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "0");
        var result = await _mediator.Send(new SignSRFCommand(id, userId, request.Password, request.Meaning, request.Reason));
        if (!result.IsSuccess)
        {
            if (result.ErrorCode == "ESIGN_AUTH_FAILED") return Unauthorized(new { error = result.ErrorCode, message = result.ErrorMessage });
            return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        }
        return Ok(new { sampleId = result.Value, status = "PendingTesting" });
    }

    // POST api/v1/samples/{id}/barcode-reprint — FR-18: audit-logged reprint with mandatory reason
    [HttpPost("{id}/barcode-reprint")]
    [Authorize(Roles = "Admin,Analyst")]
    public async Task<IActionResult> ReprintBarcode(int id, [FromBody] ReprintBarcodeRequest request)
    {
        var username = User.Identity?.Name ?? "Unknown";
        var result = await _mediator.Send(new ReprintBarcodeCommand(id, request.Reason, username));
        if (!result.IsSuccess) return result.ErrorCode == "NOT_FOUND" ? NotFound() : BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return Ok(new { sampleId = result.Value, status = "Reprinted" });
    }
}

public record RegisterSampleRequest(int LabId, int MaterialId, string LotNumber,
    DateOnly MfgDate, DateOnly ExpDate, int SampleTypeId,   // Gap 2 fix: FK int (was free-text string)
    List<int>? CheckpointIds = null);                       // operator-selected checkpoints
public record ReprintBarcodeRequest(string Reason);
