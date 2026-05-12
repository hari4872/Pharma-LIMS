namespace LIMS.Application.Interfaces;

// Contract 1: Form Template auto-selected server-side — no analyst UI dropdown
public interface IFormTemplateSelectorService
{
    Task<int?> SelectAsync(int labId, int materialId, CancellationToken ct = default);
}
