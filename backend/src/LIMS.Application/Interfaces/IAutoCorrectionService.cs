namespace LIMS.Application.Interfaces;

public record CorrectionResult(decimal CorrectedValue, bool Applied, string? Detail);

public interface IAutoCorrectionService
{
    Task<CorrectionResult> ApplyAsync(int labId, string parameterName, decimal rawNumericValue, CancellationToken ct = default);
}
