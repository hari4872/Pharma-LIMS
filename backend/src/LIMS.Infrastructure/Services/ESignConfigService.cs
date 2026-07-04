using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Domain.Enums;
using LIMS.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Infrastructure.Services;

public class ESignConfigService : IESignConfigService
{
    private readonly LimsDbContext _db;
    public ESignConfigService(LimsDbContext db) => _db = db;

    public async Task<IReadOnlyList<ESignConfig>> GetAllAsync(CancellationToken ct = default) =>
        await _db.ESignConfigs.OrderBy(x => x.ActionKey).ToListAsync(ct);

    public async Task SaveAllAsync(
        IEnumerable<(string ActionKey, ESignMethod Method, bool FourEye)> items,
        string updatedBy,
        CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var existing = await _db.ESignConfigs.ToDictionaryAsync(x => x.ActionKey, ct);

        foreach (var (actionKey, method, fourEye) in items)
        {
            if (existing.TryGetValue(actionKey, out var row))
            {
                row.Method = method;
                row.FourEye = fourEye;
                row.UpdatedBy = updatedBy;
                row.UpdatedAt = now;
            }
            else
            {
                _db.ESignConfigs.Add(new ESignConfig
                {
                    ActionKey = actionKey,
                    Method = method,
                    FourEye = fourEye,
                    UpdatedBy = updatedBy,
                    UpdatedAt = now,
                });
            }
        }

        await _db.SaveChangesAsync(ct);
    }
}
