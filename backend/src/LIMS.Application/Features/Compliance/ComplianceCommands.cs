using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.Compliance;

// ── FR-18: Periodic Re-Validation Review ─────────────────────────────

// POST /api/v1/compliance/validation-reviews
public record RecordValidationReviewCommand(
    string ReviewType,
    string Outcome,
    string? Notes,
    int ReviewerUserId,
    string Password,
    string Meaning,
    string Reason
) : IRequest<PeriodicReviewResult>;

public class RecordValidationReviewHandler : IRequestHandler<RecordValidationReviewCommand, PeriodicReviewResult>
{
    private readonly IPeriodicReviewService _svc;
    public RecordValidationReviewHandler(IPeriodicReviewService svc) => _svc = svc;

    public Task<PeriodicReviewResult> Handle(RecordValidationReviewCommand cmd, CancellationToken ct)
        => _svc.RecordReviewAsync(cmd.ReviewType, cmd.Outcome, cmd.Notes,
               cmd.ReviewerUserId, cmd.Password, cmd.Meaning, cmd.Reason, ct);
}

// GET /api/v1/compliance/validation-reviews
public record GetValidationReviewsQuery(string? ReviewType, int? LimitDays)
    : IRequest<IReadOnlyList<ValidationReviewLog>>;

public class GetValidationReviewsHandler : IRequestHandler<GetValidationReviewsQuery, IReadOnlyList<ValidationReviewLog>>
{
    private readonly IPeriodicReviewService _svc;
    public GetValidationReviewsHandler(IPeriodicReviewService svc) => _svc = svc;

    public Task<IReadOnlyList<ValidationReviewLog>> Handle(GetValidationReviewsQuery q, CancellationToken ct)
        => _svc.GetReviewHistoryAsync(q.ReviewType, q.LimitDays, ct);
}

// ── FR-20: Audit Trail / Compliance Dashboard Queries ─────────────────

// GET /api/v1/compliance/audit-trail
public record GetAuditTrailQuery(int? LabId, string? EntityType, int? UserId, DateTimeOffset? From, DateTimeOffset? To, int Page = 1, int PageSize = 50)
    : IRequest<AuditTrailPage>;

public record AuditTrailPage(IReadOnlyList<AuditTrailItem> Items, int TotalCount, int Page, int PageSize);
public record AuditTrailItem(long LogId, string EntityType, string EntityId, string Action, string ChangedBy, DateTimeOffset ChangedAt, string? Before, string? After);

public class GetAuditTrailHandler : IRequestHandler<GetAuditTrailQuery, AuditTrailPage>
{
    private readonly ILimsDbContext _db;
    public GetAuditTrailHandler(ILimsDbContext db) => _db = db;

    public async Task<AuditTrailPage> Handle(GetAuditTrailQuery q, CancellationToken ct)
    {
        var query = _db.MasterDataAuditLogs.AsQueryable();
        if (q.EntityType != null) query = query.Where(l => l.EntityType == q.EntityType);
        if (q.From.HasValue)      query = query.Where(l => l.PerformedAt >= q.From.Value);
        if (q.To.HasValue)        query = query.Where(l => l.PerformedAt <= q.To.Value);

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(l => l.PerformedAt)
            .Skip((q.Page - 1) * q.PageSize)
            .Take(q.PageSize)
            .Select(l => new AuditTrailItem(l.AuditId, l.EntityType, l.EntityId.ToString(),
                l.EventType, l.PerformedBy, l.PerformedAt, l.OldValue, l.NewValue))
            .ToListAsync(ct);

        return new AuditTrailPage(items, total, q.Page, q.PageSize);
    }
}

// GET /api/v1/compliance/signatures
public record GetSignatureLogQuery(int? UserId, DateTimeOffset? From, DateTimeOffset? To, int Page = 1, int PageSize = 50)
    : IRequest<SignatureLogPage>;

public record SignatureLogPage(IReadOnlyList<SignatureLogItem> Items, int TotalCount, int Page, int PageSize);
public record SignatureLogItem(int SignatureId, int UserId, string FullName, string Meaning, string Reason, DateTimeOffset SignedAt);

public class GetSignatureLogHandler : IRequestHandler<GetSignatureLogQuery, SignatureLogPage>
{
    private readonly ILimsDbContext _db;
    public GetSignatureLogHandler(ILimsDbContext db) => _db = db;

    public async Task<SignatureLogPage> Handle(GetSignatureLogQuery q, CancellationToken ct)
    {
        var query = _db.ElectronicSignatures.Include(s => s.User).AsQueryable();
        if (q.UserId.HasValue) query = query.Where(s => s.UserId == q.UserId.Value);
        if (q.From.HasValue)   query = query.Where(s => s.SignedAt >= q.From.Value);
        if (q.To.HasValue)     query = query.Where(s => s.SignedAt <= q.To.Value);

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(s => s.SignedAt)
            .Skip((q.Page - 1) * q.PageSize)
            .Take(q.PageSize)
            .Select(s => new SignatureLogItem(s.SignatureId, s.UserId, s.User.FullName,
                s.Meaning, s.Reason, s.SignedAt))
            .ToListAsync(ct);

        return new SignatureLogPage(items, total, q.Page, q.PageSize);
    }
}

// ── FR-17: Form Template Approval Reminder (EU Annex 11 §10) ─────────

// GET /api/v1/compliance/form-templates/pending-review
public record GetFormTemplatesPendingReviewQuery() : IRequest<IReadOnlyList<FormTemplatePendingItem>>;
public record FormTemplatePendingItem(int TemplateId, string TemplateName, string Status, DateTimeOffset CreatedAt, string CreatedBy);

public class GetFormTemplatesPendingReviewHandler : IRequestHandler<GetFormTemplatesPendingReviewQuery, IReadOnlyList<FormTemplatePendingItem>>
{
    private readonly ILimsDbContext _db;
    public GetFormTemplatesPendingReviewHandler(ILimsDbContext db) => _db = db;

    public async Task<IReadOnlyList<FormTemplatePendingItem>> Handle(GetFormTemplatesPendingReviewQuery q, CancellationToken ct)
    {
        return await _db.FormTemplates
            .Where(t => t.Status == FormTemplateStatus.Draft)
            .OrderBy(t => t.CreatedAt)
            .Select(t => new FormTemplatePendingItem(t.FormTemplateId, t.FormName, t.Status.ToString(), t.CreatedAt, t.CreatedBy))
            .ToListAsync(ct);
    }
}
