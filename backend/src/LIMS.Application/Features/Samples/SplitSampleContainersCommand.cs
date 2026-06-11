using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.Samples;

/// <summary>
/// Splits a registered sample into N containers / aliquots.
/// LabVantage parity: one sample login → multiple tracked containers.
/// </summary>
public record SplitSampleContainersCommand(
    int SampleId,
    int Count,
    ContainerType ContainerType,
    decimal? VolumePerContainer,
    string? VolumeUom,
    int? StorageLocationId,
    string CreatedBy) : IRequest<Result<List<int>>>;

public class SplitSampleContainersHandler : IRequestHandler<SplitSampleContainersCommand, Result<List<int>>>
{
    private readonly ILimsDbContext _db;
    private readonly IMasterDataAuditService _audit;

    public SplitSampleContainersHandler(ILimsDbContext db, IMasterDataAuditService audit)
    { _db = db; _audit = audit; }

    public async Task<Result<List<int>>> Handle(SplitSampleContainersCommand cmd, CancellationToken ct)
    {
        if (cmd.Count < 1 || cmd.Count > 100)
            return Result<List<int>>.Failure("INVALID_COUNT", "Container count must be between 1 and 100.");

        var sample = await _db.Samples.FirstOrDefaultAsync(s => s.SampleId == cmd.SampleId, ct);
        if (sample is null)
            return Result<List<int>>.Failure("NOT_FOUND", "Sample not found.");

        if (sample.Status != SampleStatus.Registered && sample.Status != SampleStatus.PendingTesting)
            return Result<List<int>>.Failure("INVALID_STATE",
                $"Cannot split containers on a sample with status '{sample.Status}'. Must be Registered or PendingTesting.");

        if (cmd.StorageLocationId.HasValue)
        {
            var loc = await _db.StorageLocations
                .FirstOrDefaultAsync(l => l.LocationId == cmd.StorageLocationId.Value && l.IsActive, ct);
            if (loc is null)
                return Result<List<int>>.Failure("NOT_FOUND", "Storage location not found or inactive.");
        }

        var containers = new List<SampleContainer>();
        var now = DateTimeOffset.UtcNow;

        for (int i = 1; i <= cmd.Count; i++)
        {
            var container = new SampleContainer
            {
                SampleId          = cmd.SampleId,
                ContainerLabel    = $"{sample.SampleNumber}-{cmd.ContainerType.ToString().ToUpper()[0]}{i:D3}",
                ContainerType     = cmd.ContainerType,
                Volume            = cmd.VolumePerContainer,
                VolumeUom         = cmd.VolumeUom,
                StorageLocationId = cmd.StorageLocationId,
                Status            = ContainerStatus.Available,
                CreatedBy         = cmd.CreatedBy,
                CreatedAt         = now
            };
            _db.SampleContainers.Add(container);
            containers.Add(container);
        }

        await _db.SaveChangesAsync(ct);

        try { await _audit.LogAsync("Sample", cmd.SampleId, "ContainersSplit", null,
            new { ContainerCount = cmd.Count, ContainerType = cmd.ContainerType.ToString(), cmd.CreatedBy },
            cmd.CreatedBy); } catch { /* non-critical */ }

        return Result<List<int>>.Success(containers.Select(c => c.SampleContainerId).ToList());
    }
}
