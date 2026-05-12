namespace LIMS.Application.Interfaces;

// Tier enforcement: Tier1 (Lab, Users, FormTemplates) → Tier2 (Instruments, Materials, TestMethods) → Tier3 (SpecLimits, SampleTypes)
public interface IMasterDataValidatorService
{
    Task<bool> LabExistsAndActiveAsync(int labId, CancellationToken ct = default);
    Task<bool> MaterialExistsAndActiveAsync(int materialId, CancellationToken ct = default);
    Task<bool> TestMethodExistsAndApprovedAsync(int methodId, CancellationToken ct = default);
    Task<bool> SpecLimitExistsAndApprovedAsync(int specLimitId, CancellationToken ct = default);
}
