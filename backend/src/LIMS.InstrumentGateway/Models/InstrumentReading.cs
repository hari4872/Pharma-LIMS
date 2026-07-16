namespace LIMS.InstrumentGateway.Models;

public class InstrumentReading
{
    public string InstrumentName { get; set; } = "";
    public string ParameterName { get; set; } = "";
    public string RawValue { get; set; } = "";
    public decimal? NumericValue { get; set; }
    public string Unit { get; set; } = "";
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public bool IsValid { get; set; }
    public string? SampleBarcode { get; set; }   // extracted from ASTM or prefix in raw data
    public string? ParseError { get; set; }
}

public class LimsAuthResponse
{
    public string Token { get; set; } = "";
    public DateTime ExpiresAt { get; set; }
}

public class LimsResultEntry
{
    public string ParameterName { get; set; } = "";
    public string Value { get; set; } = "";
    public string? Unit { get; set; }
}

public class LimsSubmitResultsRequest
{
    public List<LimsResultEntry> Entries { get; set; } = [];
    public string EntryMethod { get; set; } = "Instrument";
}

public class WorkQueueItem
{
    public int ExecutionId { get; set; }
    public int SampleId { get; set; }
    public string SampleNumber { get; set; } = "";
    public string? ContainerLabel { get; set; }
    public string Status { get; set; } = "";
    public string TestName { get; set; } = "";
}
