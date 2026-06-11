using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Infrastructure.Services;

// Contract 1: Single named service for all pull execution — no other path
// FR-05: Pull §11.50 e-sig — BCrypt independent of session (21 CFR §11.300)
// FR-15: ShortPullDeviation auto-logged when actual < required (ALCOA+ Complete)
public class PullExecutionService : IPullExecutionService
{
    private readonly ILimsDbContext _db;
    public PullExecutionService(ILimsDbContext db) { _db = db; }

    public async Task<PullExecutionResult> ExecuteAsync(
        int pullId, decimal actualQty, string reason,
        int analystId, string password, string meaning,
        CancellationToken ct = default)
    {
        var pull = await _db.StabilityPulls
            .Include(p => p.Sample)
            .FirstOrDefaultAsync(p => p.PullId == pullId, ct)
            ?? throw new InvalidOperationException($"Pull {pullId} not found.");

        if (pull.Status != "Pending")
            throw new InvalidOperationException($"Pull is not in Pending state (current: {pull.Status}).");

        // 21 CFR §11.300 — BCrypt independent of session
        var user = await _db.Users.FirstOrDefaultAsync(u => u.UserId == analystId, ct)
            ?? throw new InvalidOperationException("Analyst not found.");
        if (!BCrypt.Net.BCrypt.Verify(password, user.PasswordHash))
            throw new UnauthorizedAccessException("E-signature authentication failed.");

        // §11.50: full_name + signed_at UTC + meaning + reason (reason defaults to pull context if no shortfall reason)
        var sig = new ElectronicSignature
        {
            UserId = analystId,
            FullName = user.FullName,
            SignedAt = DateTimeOffset.UtcNow,
            Meaning = meaning,
            Reason = !string.IsNullOrWhiteSpace(reason) ? reason : $"Stability pull executed for pull #{pullId}",
            ActionType = "StabilityPullExecute"
        };
        _db.ElectronicSignatures.Add(sig);
        await _db.SaveChangesAsync(ct);

        int? shortDeviationId = null;
        bool hasShortfall = actualQty < pull.RequiredQty;

        // FR-15: auto-log short pull deviation (analyst cannot skip — enforced here)
        if (hasShortfall)
        {
            if (string.IsNullOrWhiteSpace(reason))
                throw new InvalidOperationException(
                    "Short pull reason is mandatory when actual quantity is less than required (FR-15).");

            var shortDev = new ShortPullDeviation
            {
                PullId = pullId,
                RequiredQty = pull.RequiredQty,
                ActualQty = actualQty,
                Shortfall = pull.RequiredQty - actualQty,
                Reason = reason,
                LoggedBy = user.Username,
                LoggedAt = DateTimeOffset.UtcNow
            };
            _db.ShortPullDeviations.Add(shortDev);
            await _db.SaveChangesAsync(ct);
            shortDeviationId = shortDev.DeviationId;
        }

        pull.Status = "Pulled";
        pull.ActualQty = actualQty;
        pull.PulledAt = DateTimeOffset.UtcNow;
        pull.ExecutedById = analystId;
        pull.SignatureId = sig.SignatureId;
        await _db.SaveChangesAsync(ct);

        return new PullExecutionResult(pullId, hasShortfall, shortDeviationId);
    }
}
