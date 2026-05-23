namespace LIMS.Domain.Entities;

// ── MS-2: Inter-site Sample Transfer ────────────────────────────────────────
/// <summary>
/// Tracks a sample physically moving from one laboratory to another.
/// Both labs must be active in the same LIMS instance.
/// Chain-of-custody is fully audited — 21 CFR §211.186.
/// </summary>
public class SampleTransfer
{
    public int SampleTransferId  { get; set; }
    public int SampleId          { get; set; }
    public Sample Sample         { get; set; } = null!;

    public int FromLabId         { get; set; }
    public Laboratory FromLab    { get; set; } = null!;
    public int ToLabId           { get; set; }
    public Laboratory ToLab      { get; set; } = null!;

    /// <summary>Why the sample is being transferred (mandatory — ALCOA+ rationale).</summary>
    public string TransferReason { get; set; } = default!;

    /// <summary>Free-text chain-of-custody note (courier, container, temp, etc.).</summary>
    public string? ChainOfCustodyNote { get; set; }

    public SampleTransferStatus Status       { get; set; } = SampleTransferStatus.Pending;

    public string RequestedBy                { get; set; } = default!;
    public DateTimeOffset RequestedAt        { get; set; } = DateTimeOffset.UtcNow;

    /// <summary>Who accepted or rejected at the destination lab.</summary>
    public string? RespondedBy               { get; set; }
    public DateTimeOffset? RespondedAt       { get; set; }
    public string? ResponseNote              { get; set; }

    /// <summary>Set when the receiving lab physically confirms receipt.</summary>
    public string? ReceivedBy               { get; set; }
    public DateTimeOffset? ReceivedAt       { get; set; }
}

public enum SampleTransferStatus
{
    Pending   = 0,  // Requested but destination lab hasn't responded
    Accepted  = 1,  // Destination lab approved — sample in transit
    Rejected  = 2,  // Destination lab declined
    InTransit = 3,  // Accepted + dispatched (source lab confirmed dispatch)
    Received  = 4,  // Destination lab confirmed physical receipt
    Cancelled = 5,  // Requester withdrew
}
