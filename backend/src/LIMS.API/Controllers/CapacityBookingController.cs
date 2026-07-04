using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LIMS.API.Controllers;

[ApiController]
[Route("api/v1/capacity-bookings")]
[Authorize]
public class CapacityBookingController : LimsControllerBase
{
    private readonly ILimsDbContext _db;
    public CapacityBookingController(ILimsDbContext db) { _db = db; }

    // GET api/v1/capacity-bookings?date=2026-06-07
    [HttpGet]
    public async Task<IActionResult> GetBookings([FromQuery] DateOnly date, CancellationToken ct)
    {
        var fromDt = date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var toDt   = date.ToDateTime(TimeOnly.MaxValue, DateTimeKind.Utc);

        var bookings = await _db.CapacityBookings
            .Where(b => b.StartTime < toDt && b.EndTime > fromDt && b.Status != "Cancelled")
            .Include(b => b.Instrument)
            .Include(b => b.BookedByUser)
            .Include(b => b.Execution).ThenInclude(e => e!.Sample)
            .AsNoTracking()
            .ToListAsync(ct);

        return Ok(bookings.Select(b => new {
            b.CapacityBookingId,
            b.InstrumentId,
            InstrumentCode = b.Instrument?.InstrumentCode ?? "[Deleted]",
            InstrumentName = b.Instrument?.InstrumentName ?? "[Deleted]",
            BookedBy       = b.BookedByUser?.FullName ?? "[Unknown]",
            b.ExecutionId,
            SampleNumber   = b.Execution?.Sample?.SampleNumber,
            StartTime      = b.StartTime,
            EndTime        = b.EndTime,
            b.Status,
            b.Notes,
        }));
    }

    // GET api/v1/capacity-bookings/instruments
    [HttpGet("instruments")]
    public async Task<IActionResult> GetInstruments(CancellationToken ct)
    {
        var instruments = await _db.Instruments
            .Where(i => i.IsActive && i.Status != InstrumentStatus.OutOfCalibration)
            .OrderBy(i => i.InstrumentCode)
            .AsNoTracking()
            .ToListAsync(ct);
        return Ok(instruments.Select(i => new {
            i.InstrumentId, i.InstrumentCode, i.InstrumentName, i.InstrumentType,
            Status = i.Status.ToString()
        }));
    }

    // GET api/v1/capacity-bookings/pending-executions — work queue items not yet booked
    [HttpGet("pending-executions")]
    public async Task<IActionResult> GetPendingExecutions(CancellationToken ct)
    {
        // Already-booked execution IDs
        var bookedIds = await _db.CapacityBookings
            .Where(b => b.ExecutionId != null && b.Status != "Cancelled" && b.Status != "Released")
            .Select(b => b.ExecutionId!.Value)
            .ToListAsync(ct);

        var pending = await _db.TestExecutions
            .Where(e => (e.Status == Domain.Enums.TestExecutionStatus.Assigned ||
                         e.Status == Domain.Enums.TestExecutionStatus.InProgress)
                        && !bookedIds.Contains(e.ExecutionId))
            .Include(e => e.Sample)
            .AsNoTracking()
            .Select(e => new {
                e.ExecutionId,
                SampleNumber = e.Sample != null ? e.Sample.SampleNumber : "—",
                e.Status,
            })
            .Take(50)
            .ToListAsync(ct);
        return Ok(pending);
    }

    // POST api/v1/capacity-bookings
    [HttpPost]
    [Authorize(Roles = "Admin,QA,LabManager,Analyst")]
    public async Task<IActionResult> Create([FromBody] CreateBookingRequest req, CancellationToken ct)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized(new { error = "Invalid token claims." });
        if (req.EndTime <= req.StartTime) return BadRequest(new { error = "END_BEFORE_START", message = "End time must be after start time." });

        // Validate ExecutionId if provided
        if (req.ExecutionId.HasValue)
        {
            var exec = await _db.TestExecutions.FindAsync([req.ExecutionId.Value], ct);
            if (exec is null) return BadRequest(new { error = "INVALID_EXECUTION", message = "Test execution not found." });

            // Prevent same execution being booked twice
            var execAlreadyBooked = await _db.CapacityBookings.AnyAsync(b =>
                b.ExecutionId == req.ExecutionId && b.Status != "Cancelled", ct);
            if (execAlreadyBooked)
                return Conflict(new { error = "EXECUTION_ALREADY_BOOKED", message = "This test execution already has an active booking." });
        }

        // Conflict check — no overlapping booking for same instrument
        var conflict = await _db.CapacityBookings.AnyAsync(b =>
            b.InstrumentId == req.InstrumentId &&
            b.Status != "Cancelled" && b.Status != "Released" &&
            b.StartTime < req.EndTime && b.EndTime > req.StartTime, ct);

        if (conflict)
            return Conflict(new { error = "TIME_CONFLICT", message = "This instrument is already booked for the selected time slot." });

        var booking = new CapacityBooking
        {
            InstrumentId   = req.InstrumentId,
            BookedByUserId = userId,
            ExecutionId    = req.ExecutionId,
            StartTime      = req.StartTime,
            EndTime        = req.EndTime,
            Notes          = req.Notes,
            Status         = "Booked",
            CreatedAt      = DateTimeOffset.UtcNow,
        };
        _db.CapacityBookings.Add(booking);
        await _db.SaveChangesAsync(ct);
        return Ok(new { booking.CapacityBookingId, booking.Status });
    }

    // PATCH api/v1/capacity-bookings/{id}/start
    [HttpPatch("{id}/start")]
    [Authorize(Roles = "Admin,QA,LabManager,Analyst")]
    public async Task<IActionResult> Start(int id, CancellationToken ct)
    {
        var b = await _db.CapacityBookings.FindAsync([id], ct);
        if (b is null) return NotFound();
        b.Status = "InUse";
        await _db.SaveChangesAsync(ct);
        return Ok(new { b.CapacityBookingId, b.Status });
    }

    // PATCH api/v1/capacity-bookings/{id}/release
    [HttpPatch("{id}/release")]
    [Authorize(Roles = "Admin,QA,LabManager,Analyst")]
    public async Task<IActionResult> Release(int id, CancellationToken ct)
    {
        var b = await _db.CapacityBookings.FindAsync([id], ct);
        if (b is null) return NotFound();
        b.Status = "Released";
        await _db.SaveChangesAsync(ct);
        return Ok(new { b.CapacityBookingId, b.Status });
    }

    // PATCH api/v1/capacity-bookings/{id}/cancel
    [HttpPatch("{id}/cancel")]
    [Authorize(Roles = "Admin,QA,LabManager,Analyst")]
    public async Task<IActionResult> Cancel(int id, [FromBody] CancelBookingRequest? body, CancellationToken ct)
    {
        var b = await _db.CapacityBookings.FindAsync([id], ct);
        if (b is null) return NotFound();
        if (b.Status == "InUse") return BadRequest(new { error = "ALREADY_IN_USE", message = "Cannot cancel a booking that is currently in use." });
        b.Status = "Cancelled";
        if (!string.IsNullOrWhiteSpace(body?.Reason))
            b.Notes = string.IsNullOrWhiteSpace(b.Notes) ? $"[Cancelled: {body.Reason}]" : $"{b.Notes} | [Cancelled: {body.Reason}]";
        await _db.SaveChangesAsync(ct);
        return Ok(new { b.CapacityBookingId, b.Status });
    }
}

public record CreateBookingRequest(
    int InstrumentId,
    DateTimeOffset StartTime,
    DateTimeOffset EndTime,
    int? ExecutionId = null,
    string? Notes    = null);

public record CancelBookingRequest(string? Reason);
