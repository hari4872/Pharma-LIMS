namespace LIMS.Application.Interfaces;

// Contract 1: Single service that resolves all CoA header fields from FK joins
// Contract 2: All fields server-side — no manual transcription (21 CFR 211.194)
public record CoAHeaderDto(
    string ProductName,
    string LotNumber,
    DateOnly? MfgDate,
    DateOnly ExpiryDate,
    string? CustomerName,
    DateOnly? DespatchDate,
    string? DoNumber,
    string? PackingType,
    string CoaNumber,
    string? DateOfIssue    // set only at QA approval — never manually entered
);

public interface ICoAHeaderService
{
    Task<CoAHeaderDto> BuildHeaderAsync(int sampleId, int? deliveryOrderId, CancellationToken ct = default);
    Task<string> GenerateCoANumberAsync(int labId, CancellationToken ct = default);
}
