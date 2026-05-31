using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.DigitalLogbook;

public record UploadEvidenceCommand(
    int EntryId, int SampleId,
    string FileName, byte[] FileBytes, string ContentType,
    string? Description, int UploadedById) : IRequest<Result<int>>;

public record EvidenceDto(
    int EvidenceId, string FileRef, string? Description,
    string UploadedByName, DateTimeOffset UploadedAt);

public class UploadEvidenceCommandHandler : IRequestHandler<UploadEvidenceCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly string _uploadsRoot;

    public UploadEvidenceCommandHandler(ILimsDbContext db)
    {
        _db = db;
        // Resolve uploads folder relative to app base directory
        _uploadsRoot = Path.Combine(AppContext.BaseDirectory, "uploads", "evidence");
    }

    public async Task<Result<int>> Handle(UploadEvidenceCommand cmd, CancellationToken ct)
    {
        var entry = await _db.DigitalLogbookEntries.FirstOrDefaultAsync(e => e.EntryId == cmd.EntryId, ct);
        if (entry is null)
            return Result<int>.Failure("NOT_FOUND", "Logbook entry not found.");

        // Build safe file path: uploads/evidence/{sampleId}/{guid}.{ext}
        var ext      = Path.GetExtension(cmd.FileName).TrimStart('.').ToLowerInvariant();
        var safeExt  = ext is "jpg" or "jpeg" or "png" or "gif" or "pdf" or "xlsx" or "csv" ? ext : "bin";
        var fileName = $"{Guid.NewGuid():N}.{safeExt}";
        var folder   = Path.Combine(_uploadsRoot, cmd.SampleId.ToString());
        Directory.CreateDirectory(folder);
        var fullPath = Path.Combine(folder, fileName);

        await File.WriteAllBytesAsync(fullPath, cmd.FileBytes, ct);

        var fileRef = $"evidence/{cmd.SampleId}/{fileName}";

        var evidence = new ResultEvidence
        {
            EntryId      = cmd.EntryId,
            SampleId     = cmd.SampleId,
            FileRef      = fileRef,
            Description  = cmd.Description,
            UploadedById = cmd.UploadedById,
            UploadedAt   = DateTimeOffset.UtcNow,
        };

        _db.ResultEvidences.Add(evidence);
        await _db.SaveChangesAsync(ct);

        return Result<int>.Success(evidence.EvidenceId);
    }
}
