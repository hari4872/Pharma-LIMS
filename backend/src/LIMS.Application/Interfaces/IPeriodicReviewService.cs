using LIMS.Domain.Entities;

namespace LIMS.Application.Interfaces;

// Contract 1: single named service for ALL periodic review logging (EU Annex 11 §12.4)
// INSERT-only — no update/delete of validation_review_logs ever
public record PeriodicReviewResult(int ReviewId, DateTimeOffset NextReviewDue);

public interface IPeriodicReviewService
{
    Task<PeriodicReviewResult> RecordReviewAsync(
        string reviewType,
        string outcome,
        string? notes,
        int reviewerUserId,
        string password,
        string meaning,
        string reason,
        CancellationToken ct = default);

    Task<IReadOnlyList<ValidationReviewLog>> GetReviewHistoryAsync(string? reviewType, int? limitDays, CancellationToken ct = default);

    Task<ValidationReviewLog?> GetNextDueAsync(string reviewType, CancellationToken ct = default);
}
