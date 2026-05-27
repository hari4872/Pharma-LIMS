using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LIMS.API.Controllers;

/// <summary>
/// MS-2: Inter-site sample transfer management.
/// Route: api/v1/sample-transfers
/// </summary>
[ApiController]
[Route("api/v1/sample-transfers")]
[Authorize]
public class SampleTransfersController : ControllerBase
{
    private readonly ILimsDbContext _db;
    private readonly ILabContext _lab;

    public SampleTransfersController(ILimsDbContext db, ILabContext lab)
    { _db = db; _lab = lab; }

    // GET api/v1/sample-transfers?status=Pending
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? status, CancellationToken ct)
    {
        var q = _db.SampleTransfers
            .Include(t => t.Sample).ThenInclude(s => s.Material)
            .Include(t => t.FromLab)
            .Include(t => t.ToLab)
            .AsQueryable();

        // Lab-scoped users only see transfers involving their lab
        if (!_lab.IsCrossLab && _lab.LabId.HasValue)
            q = q.Where(t => t.FromLabId == _lab.LabId || t.ToLabId == _lab.LabId);

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<SampleTransferStatus>(status, true, out var transferStatusEnum))
            q = q.Where(t => t.Status == transferStatusEnum);

        var list = await q.OrderByDescending(t => t.RequestedAt).Take(500).ToListAsync(ct);

        return Ok(list.Select(t => new {
            t.SampleTransferId,
            t.SampleId,
            sampleNumber  = t.Sample.SampleNumber,
            materialName  = t.Sample.Material.MaterialName,
            lotNumber     = t.Sample.LotNumber,
            fromLabId     = t.FromLabId,
            fromLabName   = t.FromLab.LabName,
            toLabId       = t.ToLabId,
            toLabName     = t.ToLab.LabName,
            status        = t.Status.ToString(),
            t.TransferReason,
            t.ChainOfCustodyNote,
            t.RequestedBy,
            t.RequestedAt,
            t.RespondedBy,
            t.RespondedAt,
            t.ResponseNote,
            t.ReceivedBy,
            t.ReceivedAt,
        }));
    }

    // GET api/v1/sample-transfers/for-sample/{sampleId}
    [HttpGet("for-sample/{sampleId:int}")]
    public async Task<IActionResult> GetForSample(int sampleId, CancellationToken ct)
    {
        var list = await _db.SampleTransfers
            .Include(t => t.FromLab)
            .Include(t => t.ToLab)
            .Where(t => t.SampleId == sampleId)
            .OrderByDescending(t => t.RequestedAt)
            .ToListAsync(ct);

        return Ok(list.Select(t => new {
            t.SampleTransferId, t.FromLabId, fromLabName = t.FromLab.LabName,
            t.ToLabId, toLabName = t.ToLab.LabName,
            status = t.Status.ToString(),
            t.TransferReason, t.ChainOfCustodyNote,
            t.RequestedBy, t.RequestedAt,
            t.RespondedBy, t.RespondedAt, t.ResponseNote,
            t.ReceivedBy, t.ReceivedAt
        }));
    }

    // POST api/v1/sample-transfers — initiate a transfer request
    [HttpPost]
    [Authorize(Roles = "Admin,QA,LabManager,Analyst")]
    public async Task<IActionResult> Initiate([FromBody] TransferRequestDto dto, CancellationToken ct)
    {
        var sample = await _db.Samples.Include(s => s.Material).FirstOrDefaultAsync(s => s.SampleId == dto.SampleId, ct);
        if (sample is null) return NotFound(new { error = "SAMPLE_NOT_FOUND" });

        // Source lab must match the user's lab (or user is cross-lab)
        if (!_lab.IsCrossLab && _lab.LabId.HasValue && sample.LabId != _lab.LabId)
            return Forbid();

        if (dto.ToLabId == sample.LabId)
            return BadRequest(new { error = "SAME_LAB", message = "Source and destination labs must differ." });

        var destLab = await _db.Laboratories.FindAsync([dto.ToLabId], ct);
        if (destLab is null) return BadRequest(new { error = "DEST_LAB_NOT_FOUND" });

        // Block duplicate in-flight transfers
        var existing = await _db.SampleTransfers
            .AnyAsync(t => t.SampleId == dto.SampleId &&
                (t.Status == SampleTransferStatus.Pending || t.Status == SampleTransferStatus.Accepted || t.Status == SampleTransferStatus.InTransit), ct);
        if (existing)
            return Conflict(new { error = "TRANSFER_IN_FLIGHT", message = "This sample already has an active transfer request." });

        var transfer = new SampleTransfer
        {
            SampleId          = dto.SampleId,
            FromLabId         = sample.LabId,
            ToLabId           = dto.ToLabId,
            TransferReason    = dto.TransferReason,
            ChainOfCustodyNote= dto.ChainOfCustodyNote,
            RequestedBy       = User.Identity?.Name ?? "Unknown",
            RequestedAt       = DateTimeOffset.UtcNow,
            Status            = SampleTransferStatus.Pending,
        };

        _db.SampleTransfers.Add(transfer);
        await _db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetAll), new { id = transfer.SampleTransferId }, new { transfer.SampleTransferId, status = "Pending" });
    }

    // POST api/v1/sample-transfers/{id}/accept
    [HttpPost("{id:int}/accept")]
    [Authorize(Roles = "Admin,QA,LabManager")]
    public async Task<IActionResult> Accept(int id, [FromBody] RespondDto dto, CancellationToken ct)
    {
        var t = await _db.SampleTransfers.FindAsync([id], ct);
        if (t is null) return NotFound();
        if (t.Status != SampleTransferStatus.Pending)
            return BadRequest(new { error = "INVALID_STATE", message = $"Cannot accept a transfer in state {t.Status}" });

        // Only the destination lab (or cross-lab user) can accept
        if (!_lab.IsCrossLab && _lab.LabId != t.ToLabId)
            return Forbid();

        t.Status      = SampleTransferStatus.Accepted;
        t.RespondedBy = User.Identity?.Name ?? "Unknown";
        t.RespondedAt = DateTimeOffset.UtcNow;
        t.ResponseNote= dto.Note;
        await _db.SaveChangesAsync(ct);
        return Ok(new { status = "Accepted" });
    }

    // POST api/v1/sample-transfers/{id}/reject
    [HttpPost("{id:int}/reject")]
    [Authorize(Roles = "Admin,QA,LabManager")]
    public async Task<IActionResult> Reject(int id, [FromBody] RespondDto dto, CancellationToken ct)
    {
        var t = await _db.SampleTransfers.FindAsync([id], ct);
        if (t is null) return NotFound();
        if (t.Status != SampleTransferStatus.Pending)
            return BadRequest(new { error = "INVALID_STATE", message = $"Cannot reject a transfer in state {t.Status}" });

        if (!_lab.IsCrossLab && _lab.LabId != t.ToLabId)
            return Forbid();

        t.Status      = SampleTransferStatus.Rejected;
        t.RespondedBy = User.Identity?.Name ?? "Unknown";
        t.RespondedAt = DateTimeOffset.UtcNow;
        t.ResponseNote= dto.Note;
        await _db.SaveChangesAsync(ct);
        return Ok(new { status = "Rejected" });
    }

    // POST api/v1/sample-transfers/{id}/dispatch
    [HttpPost("{id:int}/dispatch")]
    [Authorize(Roles = "Admin,QA,LabManager,Analyst")]
    public async Task<IActionResult> Dispatch(int id, [FromBody] RespondDto dto, CancellationToken ct)
    {
        var t = await _db.SampleTransfers.FindAsync([id], ct);
        if (t is null) return NotFound();
        if (t.Status != SampleTransferStatus.Accepted)
            return BadRequest(new { error = "INVALID_STATE", message = "Transfer must be Accepted before dispatching." });

        if (!_lab.IsCrossLab && _lab.LabId != t.FromLabId)
            return Forbid();

        t.Status       = SampleTransferStatus.InTransit;
        t.ResponseNote = dto.Note;
        await _db.SaveChangesAsync(ct);
        return Ok(new { status = "InTransit" });
    }

    // POST api/v1/sample-transfers/{id}/receive
    [HttpPost("{id:int}/receive")]
    [Authorize(Roles = "Admin,QA,LabManager,Analyst")]
    public async Task<IActionResult> Receive(int id, [FromBody] RespondDto dto, CancellationToken ct)
    {
        var t = await _db.SampleTransfers
            .Include(x => x.Sample)
            .FirstOrDefaultAsync(x => x.SampleTransferId == id, ct);
        if (t is null) return NotFound();
        if (t.Status != SampleTransferStatus.InTransit)
            return BadRequest(new { error = "INVALID_STATE", message = "Transfer must be InTransit before receiving." });

        if (!_lab.IsCrossLab && _lab.LabId != t.ToLabId)
            return Forbid();

        t.Status     = SampleTransferStatus.Received;
        t.ReceivedBy = User.Identity?.Name ?? "Unknown";
        t.ReceivedAt = DateTimeOffset.UtcNow;
        t.ResponseNote = dto.Note;

        // Re-home the sample to the destination lab
        t.Sample.LabId = t.ToLabId;

        await _db.SaveChangesAsync(ct);
        return Ok(new { status = "Received", newLabId = t.ToLabId });
    }

    // POST api/v1/sample-transfers/{id}/cancel
    [HttpPost("{id:int}/cancel")]
    public async Task<IActionResult> Cancel(int id, [FromBody] RespondDto dto, CancellationToken ct)
    {
        var t = await _db.SampleTransfers.FindAsync([id], ct);
        if (t is null) return NotFound();
        if (t.Status == SampleTransferStatus.Received || t.Status == SampleTransferStatus.Cancelled)
            return BadRequest(new { error = "INVALID_STATE" });

        if (!_lab.IsCrossLab && _lab.LabId != t.FromLabId)
            return Forbid();

        t.Status = SampleTransferStatus.Cancelled;
        t.ResponseNote = dto.Note;
        await _db.SaveChangesAsync(ct);
        return Ok(new { status = "Cancelled" });
    }
}

// ── Request DTOs ──────────────────────────────────────────────────────────────
public record TransferRequestDto(
    int    SampleId,
    int    ToLabId,
    string TransferReason,
    string? ChainOfCustodyNote
);

public record RespondDto(string? Note);
