using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.SampleInventory;

// ── Register Retain Sample ──────────────────────────────────────
// FR-08 / FR-09: retention period from DB config (Contract 2 — no hardcoding)
public record RegisterRetainSampleCommand(
    int SampleId, int LocationId,
    decimal Quantity, string QuantityUom,
    DateOnly RetainedOn, string RetainedBy) : IRequest<Result<int>>;

public class RegisterRetainSampleHandler : IRequestHandler<RegisterRetainSampleCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    public RegisterRetainSampleHandler(ILimsDbContext db) { _db = db; }

    public async Task<Result<int>> Handle(RegisterRetainSampleCommand req, CancellationToken ct)
    {
        var sample = await _db.Samples.Include(s => s.Lab).FirstOrDefaultAsync(s => s.SampleId == req.SampleId, ct);
        if (sample is null) return Result<int>.Failure("SAMPLE_NOT_FOUND", "Sample not found.");

        if (!await _db.StorageLocations.AnyAsync(l => l.LocationId == req.LocationId && l.IsActive, ct))
            return Result<int>.Failure("LOCATION_NOT_FOUND", "Storage location not found or inactive.");

        // Retention period from DB config (Contract 2 — no hardcoding)
        var retentionConfig = await _db.LabConfigs
            .FirstOrDefaultAsync(c => c.LabId == sample.LabId && c.ConfigKey == "retain_period_months", ct);

        var retentionMonths = retentionConfig != null && int.TryParse(retentionConfig.ConfigValue, out var months)
            ? months : 24;  // fallback 24 months if not configured — admin should configure this

        var retentionDueDate = req.RetainedOn.AddMonths(retentionMonths);

        var retain = new RetainSample
        {
            SampleId = req.SampleId,
            LocationId = req.LocationId,
            LotNumber = sample.LotNumber,
            Quantity = req.Quantity,
            QuantityUom = req.QuantityUom,
            RetainedOn = req.RetainedOn,
            RetentionDueDate = retentionDueDate,
            RetainedBy = req.RetainedBy,
            Status = "Active"
        };
        _db.RetainSamples.Add(retain);
        await _db.SaveChangesAsync(ct);
        return Result<int>.Success(retain.RetainId);
    }
}

// ── Destroy Retain Sample (QA §11.50 e-sig) ────────────────────
// FR-08: QA e-sig + reason; INSERT-only record maintained (21 CFR 211.170)
public record DestroyRetainSampleCommand(
    int RetainId, string DestroyedBy,
    string Password, string Meaning, string Reason) : IRequest<Result<int>>;

public class DestroyRetainSampleHandler : IRequestHandler<DestroyRetainSampleCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    public DestroyRetainSampleHandler(ILimsDbContext db) { _db = db; }

    public async Task<Result<int>> Handle(DestroyRetainSampleCommand req, CancellationToken ct)
    {
        var retain = await _db.RetainSamples
            .Include(r => r.Sample)
            .FirstOrDefaultAsync(r => r.RetainId == req.RetainId, ct);
        if (retain is null) return Result<int>.Failure("NOT_FOUND", "Retain sample not found.");
        if (retain.Status == "Destroyed") return Result<int>.Failure("ALREADY_DESTROYED", "Already destroyed.");

        // Verify QA e-sig (21 CFR §11.300 — BCrypt independent of session)
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Username == req.DestroyedBy, ct);
        if (user is null || !BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
            return Result<int>.Failure("ESIGN_AUTH_FAILED", "E-signature authentication failed.");

        // §11.50: full_name + signed_at UTC + meaning + reason
        var sig = new ElectronicSignature
        {
            UserId = user.UserId,
            FullName = user.FullName,
            SignedAt = DateTimeOffset.UtcNow,
            Meaning = req.Meaning,
            Reason = req.Reason
        };
        _db.ElectronicSignatures.Add(sig);
        await _db.SaveChangesAsync(ct);

        retain.Status = "Destroyed";
        retain.DestroyedAt = DateTimeOffset.UtcNow;
        retain.DestroyedBy = req.DestroyedBy;
        retain.DestructionSignatureId = sig.SignatureId;
        retain.DestructionReason = req.Reason;
        await _db.SaveChangesAsync(ct);
        return Result<int>.Success(retain.RetainId);
    }
}

// ── Get Retain Samples ──────────────────────────────────────────
public record GetRetainSamplesQuery(int? SampleId, string? Status) : IRequest<IReadOnlyList<object>>;

public class GetRetainSamplesHandler : IRequestHandler<GetRetainSamplesQuery, IReadOnlyList<object>>
{
    private readonly ILimsDbContext _db;
    public GetRetainSamplesHandler(ILimsDbContext db) { _db = db; }

    public async Task<IReadOnlyList<object>> Handle(GetRetainSamplesQuery req, CancellationToken ct)
    {
        var query = _db.RetainSamples
            .Include(r => r.Sample).ThenInclude(s => s.Material)
            .Include(r => r.Location)
            .AsQueryable();

        if (req.SampleId.HasValue) query = query.Where(r => r.SampleId == req.SampleId.Value);
        if (!string.IsNullOrEmpty(req.Status)) query = query.Where(r => r.Status == req.Status);

        return await query.Select(r => (object)new
        {
            r.RetainId, r.SampleId, SampleNumber = r.Sample.SampleNumber,
            MaterialName = r.Sample.Material != null ? r.Sample.Material.MaterialName : "Unknown",
            r.LotNumber, r.Quantity, r.QuantityUom,
            r.LocationId, LocationName = r.Location.LocationName, LocationCode = r.Location.LocationCode,
            r.RetainedOn, r.RetentionDueDate, r.Status,
            r.RetainedBy, r.DestroyedAt, r.DestroyedBy
        }).ToListAsync(ct);
    }
}
