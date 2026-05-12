using LIMS.Domain.Enums;

namespace LIMS.Application.Interfaces;

// Contract 1: Single CLEARED/BLOCKED setter — no role can set CLEARED manually
// Contract 2: CLEARED status set server-side on QA approval only
public interface IDispatchStatusService
{
    Task SetStatusAsync(int doId, DispatchStatus status, CancellationToken ct = default);
}
