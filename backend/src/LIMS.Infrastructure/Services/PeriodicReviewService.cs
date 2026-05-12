using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Infrastructure.Services;

// Contract 1: single named service for ALL periodic review logging (EU Annex 11 §12.4)
// Contract 2: review_interval_months from DB config — not hardcoded
// INSERT-only into validation_review_logs — no updates, no deletes
public class PeriodicReviewService : IPeriodicReviewService
{
    private readonly ILimsDbContext _db;
    private readonly IElectronicSignatureService _esig;

    public PeriodicReviewService(ILimsDbContext db, IElectronicSignatureService esig)
    { _db = db; _esig = esig; }

    public async Task<PeriodicReviewResult> RecordReviewAsync(
        string reviewType, string outcome, string? notes,
        int reviewerUserId, string password, string meaning, string reason,
        CancellationToken ct = default)
    {
        // §11.300: BCrypt verify independent of session
        var sig = await _esig.CreateSignatureAsync(reviewerUserId, password, meaning, reason, "PeriodicReview", ct);
        if (sig is null) throw new UnauthorizedAccessException("ESIGN_AUTH_FAILED");

        // Next review due from DB config (Contract 2 — not hardcoded)
        var intervalMonths = await GetIntervalMonthsAsync(reviewType, ct);
        var nextDue = DateTimeOffset.UtcNow.AddMonths(intervalMonths);

        var review = new ValidationReviewLog
        {
            ReviewType   = reviewType,
            ReviewedBy   = (await _db.Users.Where(u => u.UserId == reviewerUserId).Select(u => u.FullName).FirstOrDefaultAsync(ct)) ?? reviewerUserId.ToString(),
            ReviewedAt   = DateTimeOffset.UtcNow,
            Outcome      = outcome,
            Notes        = notes,
            SignatureId  = sig.SignatureId,
            NextReviewDue = nextDue
        };
        _db.ValidationReviewLogs.Add(review);
        await _db.SaveChangesAsync(ct);

        return new PeriodicReviewResult(review.ReviewId, nextDue);
    }

    public async Task<IReadOnlyList<ValidationReviewLog>> GetReviewHistoryAsync(string? reviewType, int? limitDays, CancellationToken ct = default)
    {
        var q = _db.ValidationReviewLogs.Include(r => r.Signature).AsQueryable();
        if (reviewType != null) q = q.Where(r => r.ReviewType == reviewType);
        if (limitDays.HasValue)
        {
            var since = DateTimeOffset.UtcNow.AddDays(-limitDays.Value);
            q = q.Where(r => r.ReviewedAt >= since);
        }
        return await q.OrderByDescending(r => r.ReviewedAt).ToListAsync(ct);
    }

    public async Task<ValidationReviewLog?> GetNextDueAsync(string reviewType, CancellationToken ct = default)
    {
        return await _db.ValidationReviewLogs
            .Where(r => r.ReviewType == reviewType)
            .OrderByDescending(r => r.ReviewedAt)
            .FirstOrDefaultAsync(ct);
    }

    private async Task<int> GetIntervalMonthsAsync(string reviewType, CancellationToken ct)
    {
        var key = $"review_interval_months_{reviewType.ToLower()}";
        var config = await _db.LabConfigs.FirstOrDefaultAsync(c => c.ConfigKey == key, ct);
        if (config != null && int.TryParse(config.ConfigValue, out var v)) return v;
        return 12; // annual by default — admin sets review_interval_months_{reviewType} in LabConfig
    }
}
