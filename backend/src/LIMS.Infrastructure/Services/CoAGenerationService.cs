using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Infrastructure.Services;

// Contract 1: Single CoA builder — triggered only by QCLeadVerifyHandler
// Pulls results from digital_logbook_entries FK join — no re-entry (21 CFR 211.194)
public class CoAGenerationService : ICoAGenerationService
{
    private readonly ILimsDbContext _db;
    private readonly ICoAHeaderService _header;

    public CoAGenerationService(ILimsDbContext db, ICoAHeaderService header)
    { _db = db; _header = header; }

    public async Task<int> GenerateDraftAsync(int sampleId, int executionId, CancellationToken ct = default)
    {
        // Fetch sample via execution join — avoids broken-FK false-nulls when querying samples directly
        var sampleRow = await _db.TestExecutions
            .Where(e => e.ExecutionId == executionId && e.SampleId == sampleId)
            .Select(e => new { e.Sample!.FormTemplateId })
            .FirstOrDefaultAsync(ct);

        // Idempotency guard — return existing Draft CoA if already generated (prevents duplicates on retry)
        var existing = await _db.Coas.FirstOrDefaultAsync(c => c.SampleId == sampleId && c.Status == CoaStatus.Draft, ct);
        if (existing is not null)
            return existing.CoaId;

        // Resolve CoA number from lab_config format (Contract 2 — not hardcoded)
        var headerDto = await _header.BuildHeaderAsync(sampleId, deliveryOrderId: null, ct);

        var coa = new Coa
        {
            SampleId       = sampleId,
            CoaNumber      = headerDto.CoaNumber,
            FormTemplateId = sampleRow?.FormTemplateId,
            Status         = CoaStatus.Draft,
        };
        _db.Coas.Add(coa);
        await _db.SaveChangesAsync(ct);  // get CoaId

        // Build CoA lines from digital_logbook_entries (FK join — no copy — Contract 1)
        var entries = await _db.DigitalLogbookEntries
            .Include(e => e.Parameter)
            .Where(e => e.ExecutionId == executionId && e.Status == LogbookEntryStatus.Signed)
            .OrderBy(e => e.ParameterId)
            .ToListAsync(ct);

        int order = 1;
        foreach (var entry in entries)
        {
            _db.CoaLines.Add(new CoaLine
            {
                CoaId        = coa.CoaId,
                EntryId      = entry.EntryId,
                ParameterId  = entry.ParameterId,
                DisplayOrder = order++
            });
        }

        await _db.SaveChangesAsync(ct);
        return coa.CoaId;
    }
}
