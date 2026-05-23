using LIMS.Domain.Entities;

namespace LIMS.Application.Interfaces;

public interface IWorkflowEngineService
{
    /// <summary>Find the best matching workflow template for a material + sample type combo.</summary>
    Task<WorkflowTemplate?> GetActiveTemplateAsync(int materialId, int sampleTypeId, CancellationToken ct = default);

    /// <summary>Get all steps for a sample's workflow in order.</summary>
    Task<List<WorkflowStep>> GetStepsAsync(int sampleId, CancellationToken ct = default);

    /// <summary>Check whether all gate conditions for a step are met.</summary>
    Task<GateCheckResult> CheckGatesAsync(int sampleId, string gateCondition, CancellationToken ct = default);
}

public record GateCheckResult(bool Passed, string Message);
