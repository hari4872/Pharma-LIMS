namespace LIMS.Application.Interfaces;

// Contract 1: Single CoA builder — no other service creates a CoA
// Triggered automatically by QC Lead verification
public interface ICoAGenerationService
{
    /// <summary>
    /// Auto-generates a Draft CoA from the completed test execution.
    /// Called by QCLeadVerifyHandler after successful verification.
    /// </summary>
    Task<int> GenerateDraftAsync(int sampleId, int executionId, CancellationToken ct = default);
}
