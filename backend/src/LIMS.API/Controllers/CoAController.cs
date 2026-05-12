using LIMS.Application.Features.CoA;
using LIMS.Application.Interfaces;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LIMS.API.Controllers;

[ApiController]
[Route("api/v1/coas")]
[Authorize]
public class CoAController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly IQAReviewGateService _qaGate;
    public CoAController(IMediator mediator, IQAReviewGateService qaGate)
    { _mediator = mediator; _qaGate = qaGate; }

    // GET api/v1/coas?sampleId=&status=
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] int? sampleId, [FromQuery] string? status)
    {
        var result = await _mediator.Send(new GetCoAQuery(sampleId, status));
        return Ok(result);
    }

    // GET api/v1/coas/{id}
    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var result = await _mediator.Send(new GetCoAQuery(null, null));
        var coa = result.FirstOrDefault(c => c.CoaId == id);
        if (coa is null) return NotFound();
        return Ok(coa);
    }

    // GET api/v1/coas/{id}/checklist — evaluate all 10 QA checklist items (vw_qa_checklist)
    [HttpGet("{id}/checklist")]
    [Authorize(Roles = "QA,Admin,QCLead")]
    public async Task<IActionResult> GetChecklist(int id)
    {
        // Resolve sampleId for this CoA
        var coas = await _mediator.Send(new GetCoAQuery(null, null));
        var coa = coas.FirstOrDefault(c => c.CoaId == id);
        if (coa is null) return NotFound();
        var result = await _qaGate.EvaluateChecklistAsync(coa.SampleId, id);
        return Ok(result);
    }

    // POST api/v1/coas/generate — manual CoA generation trigger (auto-trigger is via QCLead verify)
    [HttpPost("generate")]
    [Authorize(Roles = "QCLead,QA,Admin")]
    public async Task<IActionResult> Generate([FromBody] GenerateCoARequest request)
    {
        var result = await _mediator.Send(new GenerateCoACommand(request.SampleId, request.ExecutionId));
        if (!result.IsSuccess) return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        return Ok(new { coaId = result.Value });
    }

    // POST api/v1/coas/{id}/approve — QA §11.50 approval, locks PDF atomically
    [HttpPost("{id}/approve")]
    [Authorize(Roles = "QA,Admin")]
    public async Task<IActionResult> Approve(int id, [FromBody] CoASignRequest request)
    {
        var qaUserId = int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "0");
        var result = await _mediator.Send(new ApproveCoACommand(id, qaUserId,
            request.Password, request.Meaning, request.Reason));
        if (!result.IsSuccess)
        {
            if (result.ErrorCode == "ESIGN_AUTH_FAILED") return Unauthorized(new { error = result.ErrorCode, message = result.ErrorMessage });
            return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        }
        return Ok(new { approvalId = result.Value, decision = "Approved" });
    }

    // POST api/v1/coas/{id}/reject — QA rejection + justification, INSERT-only (EU Annex 11 §13)
    [HttpPost("{id}/reject")]
    [Authorize(Roles = "QA,Admin")]
    public async Task<IActionResult> Reject(int id, [FromBody] CoARejectRequest request)
    {
        var qaUserId = int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "0");
        var result = await _mediator.Send(new RejectCoACommand(id, qaUserId,
            request.Justification, request.Password, request.Meaning, request.Reason));
        if (!result.IsSuccess)
        {
            if (result.ErrorCode == "ESIGN_AUTH_FAILED") return Unauthorized(new { error = result.ErrorCode, message = result.ErrorMessage });
            return BadRequest(new { error = result.ErrorCode, message = result.ErrorMessage });
        }
        return Ok(new { approvalId = result.Value, decision = "Rejected" });
    }
}

public record GenerateCoARequest(int SampleId, int ExecutionId);
public record CoASignRequest(string Password, string Meaning, string Reason);
public record CoARejectRequest(string Justification, string Password, string Meaning, string Reason);
