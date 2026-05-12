using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Infrastructure.Services;

// Contract 1: 5 GMP pre-checks — single service, no duplicate validation logic (FR-03 to FR-08)
public class SampleValidatorService : ISampleValidatorService
{
    private readonly ILimsDbContext _db;
    public SampleValidatorService(ILimsDbContext db) => _db = db;

    public async Task<SampleValidationResult> ValidateAsync(
        int labId, int materialId, int analystId,
        DateOnly expDate, CancellationToken ct = default)
    {
        var failures = new List<string>();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        // Check 1: lot not expired (FR-03)
        if (expDate < today)
            failures.Add("Lot is expired — registration blocked.");

        // Check 2: approved spec exists for material (FR-04)
        var hasApprovedSpec = await _db.SpecLimits.AnyAsync(
            s => s.MaterialId == materialId && s.IsActive && s.Status == ApprovalStatus.Approved, ct);
        if (!hasApprovedSpec)
            failures.Add("No approved spec limit found for this material — registration blocked.");

        // Check 3: instrument calibrated — at least one available, calibrated instrument in lab (FR-05)
        var hasValidInstrument = await _db.Instruments.AnyAsync(
            i => i.LabId == labId && i.IsActive
                && i.Status != InstrumentStatus.OutOfCalibration
                && i.Status != InstrumentStatus.Maintenance
                && i.CalibrationDue >= today, ct);
        if (!hasValidInstrument)
            failures.Add("No calibrated instrument available in this lab — registration blocked. (21 CFR 211.68)");

        // Check 4: analyst trained — training record not expired (FR-06, 21 CFR §11.10(i))
        var hasValidTraining = await _db.UserTrainingRecords.AnyAsync(
            t => t.UserId == analystId && t.ValidUntil >= today, ct);
        if (!hasValidTraining)
            failures.Add("Analyst training expired or not recorded — registration blocked. (21 CFR §11.10(i))");

        // Check 5: reagents in stock — active reagent/standard materials exist (FR-07)
        var hasReagents = await _db.Materials.AnyAsync(
            m => (m.MaterialType == MaterialType.Reagent || m.MaterialType == MaterialType.Standard) && m.IsActive, ct);
        if (!hasReagents)
            failures.Add("No active reagents or standards in stock — registration blocked.");

        return new SampleValidationResult(failures.Count == 0, failures);
    }
}
