namespace LIMS.Application.Interfaces;

// Contract 1: Single sender — ERP + Archive (no duplicate distribution path)
public interface ICoADistributionService
{
    Task DistributeAsync(int coaId, CancellationToken ct = default);
}
