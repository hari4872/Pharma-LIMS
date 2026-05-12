using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Infrastructure.Services;

public class MasterDataValidatorService : IMasterDataValidatorService
{
    private readonly ILimsDbContext _db;
    public MasterDataValidatorService(ILimsDbContext db) => _db = db;

    public Task<bool> LabExistsAndActiveAsync(int labId, CancellationToken ct = default)
        => _db.Laboratories.AnyAsync(l => l.LabId == labId && l.IsActive, ct);

    public Task<bool> MaterialExistsAndActiveAsync(int materialId, CancellationToken ct = default)
        => _db.Materials.AnyAsync(m => m.MaterialId == materialId && m.IsActive, ct);

    public Task<bool> TestMethodExistsAndApprovedAsync(int methodId, CancellationToken ct = default)
        => _db.TestMethods.AnyAsync(m => m.MethodId == methodId && m.IsActive && m.Status == ApprovalStatus.Approved, ct);

    public Task<bool> SpecLimitExistsAndApprovedAsync(int specLimitId, CancellationToken ct = default)
        => _db.SpecLimits.AnyAsync(s => s.SpecLimitId == specLimitId && s.IsActive && s.Status == ApprovalStatus.Approved, ct);
}
