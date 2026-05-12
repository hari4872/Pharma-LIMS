namespace LIMS.Application.Interfaces;

public record SampleValidationResult(bool IsValid, List<string> Failures);

// Contract 1: 5 GMP pre-checks — single service, no duplicate validation logic
public interface ISampleValidatorService
{
    Task<SampleValidationResult> ValidateAsync(
        int labId, int materialId, int analystId,
        System.DateOnly expDate, CancellationToken ct = default);
}
