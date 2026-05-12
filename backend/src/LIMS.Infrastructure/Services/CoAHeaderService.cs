using LIMS.Application.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Infrastructure.Services;

// Contract 1: Single service resolving all CoA header fields from FK joins
// Contract 2: All fields server-side — CoA number from lab_config format (not hardcoded)
public class CoAHeaderService : ICoAHeaderService
{
    private readonly ILimsDbContext _db;
    public CoAHeaderService(ILimsDbContext db) => _db = db;

    public async Task<CoAHeaderDto> BuildHeaderAsync(int sampleId, int? deliveryOrderId, CancellationToken ct = default)
    {
        var sample = await _db.Samples
            .Include(s => s.Material)
            .Include(s => s.Lab)
            .FirstOrDefaultAsync(s => s.SampleId == sampleId, ct)
            ?? throw new InvalidOperationException($"Sample {sampleId} not found.");

        // Expiry date: server-calculated from mfg_date + shelf_life_days (Contract 2)
        var expiryDate = sample.MfgDate.AddDays(sample.Material.ShelfLifeDays);

        string? customerName = null, doNumber = null, packingType = null;
        DateOnly? despatchDate = null;

        if (deliveryOrderId.HasValue)
        {
            var deliveryOrder = await _db.DeliveryOrders.FindAsync(new object[] { deliveryOrderId.Value }, ct);
            if (deliveryOrder is not null)
            {
                customerName = deliveryOrder.CustomerName;
                doNumber     = deliveryOrder.DoNumber;
                despatchDate = deliveryOrder.DespatchDate;
                packingType  = deliveryOrder.PackingType;
            }
        }

        var coaNumber = await GenerateCoANumberAsync(sample.LabId, ct);

        return new CoAHeaderDto(
            ProductName:  sample.Material.MaterialName,
            LotNumber:    sample.LotNumber,
            MfgDate:      sample.MfgDate,
            ExpiryDate:   expiryDate,
            CustomerName: customerName,
            DespatchDate: despatchDate,
            DoNumber:     doNumber,
            PackingType:  packingType,
            CoaNumber:    coaNumber,
            DateOfIssue:  null  // set only at QA approval — never pre-populated (Contract 2)
        );
    }

    public async Task<string> GenerateCoANumberAsync(int labId, CancellationToken ct = default)
    {
        // Format from lab_config key 'coa_number_format' (Contract 2 — not hardcoded)
        // e.g. "COA-{YYYY}-{SEQ5}" → "COA-2026-00042"
        var config = await _db.LabConfigs
            .FirstOrDefaultAsync(c => c.LabId == labId && c.ConfigKey == "coa_number_format", ct);

        var format = config?.ConfigValue ?? "COA-{YYYY}-{SEQ5}";
        var count  = await _db.Coas.CountAsync(c => c.Sample.LabId == labId, ct) + 1;
        var year   = DateTime.UtcNow.Year.ToString();
        var yearShort = year.Substring(2);

        var result = format
            .Replace("{YYYY}", year)
            .Replace("{YY}", yearShort)
            .Replace("{SEQ5}", count.ToString("D5"))
            .Replace("{SEQ4}", count.ToString("D4"));

        return result;
    }
}
