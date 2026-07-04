using LIMS.Domain.Entities;
using LIMS.Domain.Enums;

namespace LIMS.Application.Interfaces;

public interface IESignConfigService
{
    Task<IReadOnlyList<ESignConfig>> GetAllAsync(CancellationToken ct = default);
    Task SaveAllAsync(IEnumerable<(string ActionKey, ESignMethod Method, bool FourEye)> items, string updatedBy, CancellationToken ct = default);
}
