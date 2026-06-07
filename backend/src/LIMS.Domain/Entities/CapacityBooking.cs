using System.ComponentModel.DataAnnotations.Schema;

namespace LIMS.Domain.Entities;

[Table("capacity_bookings")]
public class CapacityBooking
{
    public int CapacityBookingId { get; set; }
    public int InstrumentId { get; set; }
    public Instrument Instrument { get; set; } = default!;
    public int BookedByUserId { get; set; }
    public User BookedByUser { get; set; } = default!;
    public int? ExecutionId { get; set; }
    public TestExecution? Execution { get; set; }
    public DateTimeOffset StartTime { get; set; }
    public DateTimeOffset EndTime { get; set; }
    /// <summary>Booked | InUse | Released | Cancelled</summary>
    public string Status { get; set; } = "Booked";
    public string? Notes { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
