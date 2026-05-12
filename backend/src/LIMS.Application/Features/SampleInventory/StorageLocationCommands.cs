using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.SampleInventory;

// ── Create Storage Location ─────────────────────────────────────
public record CreateStorageLocationCommand(
    int LabId, string LocationCode, string LocationName,
    string LocationType,
    decimal? TempMinC, decimal? TempMaxC,
    decimal? HumidityMinPct, decimal? HumidityMaxPct,
    int? LowStockThreshold) : IRequest<Result<int>>;

public class CreateStorageLocationHandler : IRequestHandler<CreateStorageLocationCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    public CreateStorageLocationHandler(ILimsDbContext db) { _db = db; }

    public async Task<Result<int>> Handle(CreateStorageLocationCommand req, CancellationToken ct)
    {
        if (!Enum.TryParse<LocationType>(req.LocationType, out var locType))
            return Result<int>.Failure("INVALID_TYPE", $"LocationType must be one of: {string.Join(", ", Enum.GetNames<LocationType>())}");

        if (await _db.StorageLocations.AnyAsync(l => l.LocationCode == req.LocationCode, ct))
            return Result<int>.Failure("DUPLICATE_CODE", $"Location code '{req.LocationCode}' already exists.");

        var lab = await _db.Laboratories.FirstOrDefaultAsync(l => l.LabId == req.LabId, ct);
        if (lab is null) return Result<int>.Failure("LAB_NOT_FOUND", "Laboratory not found.");

        var loc = new StorageLocation
        {
            LabId = req.LabId,
            LocationCode = req.LocationCode,
            LocationName = req.LocationName,
            LocationType = locType,
            TempMinC = req.TempMinC,
            TempMaxC = req.TempMaxC,
            HumidityMinPct = req.HumidityMinPct,
            HumidityMaxPct = req.HumidityMaxPct,
            LowStockThreshold = req.LowStockThreshold
        };
        _db.StorageLocations.Add(loc);
        await _db.SaveChangesAsync(ct);
        return Result<int>.Success(loc.LocationId);
    }
}

// ── Update Storage Location ─────────────────────────────────────
public record UpdateStorageLocationCommand(
    int LocationId, string LocationName, string LocationType,
    decimal? TempMinC, decimal? TempMaxC,
    decimal? HumidityMinPct, decimal? HumidityMaxPct,
    int? LowStockThreshold) : IRequest<Result<int>>;

public class UpdateStorageLocationHandler : IRequestHandler<UpdateStorageLocationCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    public UpdateStorageLocationHandler(ILimsDbContext db) { _db = db; }

    public async Task<Result<int>> Handle(UpdateStorageLocationCommand req, CancellationToken ct)
    {
        var loc = await _db.StorageLocations.FirstOrDefaultAsync(l => l.LocationId == req.LocationId, ct);
        if (loc is null) return Result<int>.Failure("NOT_FOUND", "Storage location not found.");

        if (!Enum.TryParse<LocationType>(req.LocationType, out var locType))
            return Result<int>.Failure("INVALID_TYPE", $"LocationType must be one of: {string.Join(", ", Enum.GetNames<LocationType>())}");

        loc.LocationName = req.LocationName;
        loc.LocationType = locType;
        loc.TempMinC = req.TempMinC;
        loc.TempMaxC = req.TempMaxC;
        loc.HumidityMinPct = req.HumidityMinPct;
        loc.HumidityMaxPct = req.HumidityMaxPct;
        loc.LowStockThreshold = req.LowStockThreshold;
        await _db.SaveChangesAsync(ct);
        return Result<int>.Success(loc.LocationId);
    }
}

// ── Get Storage Locations Query ─────────────────────────────────
public record GetStorageLocationsQuery(int? LabId) : IRequest<IReadOnlyList<object>>;

public class GetStorageLocationsHandler : IRequestHandler<GetStorageLocationsQuery, IReadOnlyList<object>>
{
    private readonly ILimsDbContext _db;
    public GetStorageLocationsHandler(ILimsDbContext db) { _db = db; }

    public async Task<IReadOnlyList<object>> Handle(GetStorageLocationsQuery req, CancellationToken ct)
    {
        var query = _db.StorageLocations.Include(l => l.Lab).Where(l => l.IsActive);
        if (req.LabId.HasValue) query = query.Where(l => l.LabId == req.LabId.Value);

        return await query.Select(l => (object)new
        {
            l.LocationId, l.LocationCode, l.LocationName,
            LocationType = l.LocationType.ToString(),
            l.LabId, LabName = l.Lab.LabName,
            l.TempMinC, l.TempMaxC, l.HumidityMinPct, l.HumidityMaxPct,
            l.LowStockThreshold, l.IsActive
        }).ToListAsync(ct);
    }
}

// ── Transfer Sample (INSERT-only — 21 CFR 211.170) ─────────────
public record TransferSampleCommand(
    int SampleId, int FromLocationId, int ToLocationId,
    string TransferredBy, string? Reason) : IRequest<Result<int>>;

public class TransferSampleHandler : IRequestHandler<TransferSampleCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    public TransferSampleHandler(ILimsDbContext db) { _db = db; }

    public async Task<Result<int>> Handle(TransferSampleCommand req, CancellationToken ct)
    {
        if (!await _db.Samples.AnyAsync(s => s.SampleId == req.SampleId, ct))
            return Result<int>.Failure("SAMPLE_NOT_FOUND", "Sample not found.");
        if (!await _db.StorageLocations.AnyAsync(l => l.LocationId == req.FromLocationId && l.IsActive, ct))
            return Result<int>.Failure("FROM_LOCATION_NOT_FOUND", "Source location not found or inactive.");
        if (!await _db.StorageLocations.AnyAsync(l => l.LocationId == req.ToLocationId && l.IsActive, ct))
            return Result<int>.Failure("TO_LOCATION_NOT_FOUND", "Destination location not found or inactive.");
        if (req.FromLocationId == req.ToLocationId)
            return Result<int>.Failure("SAME_LOCATION", "Source and destination must differ.");

        // INSERT-only — never update existing records (21 CFR 211.170)
        var log = new StorageTransferLog
        {
            SampleId = req.SampleId,
            FromLocationId = req.FromLocationId,
            ToLocationId = req.ToLocationId,
            TransferredBy = req.TransferredBy,
            TransferredAt = DateTimeOffset.UtcNow,
            Reason = req.Reason
        };
        _db.StorageTransferLogs.Add(log);
        await _db.SaveChangesAsync(ct);
        return Result<int>.Success(log.TransferId);
    }
}
