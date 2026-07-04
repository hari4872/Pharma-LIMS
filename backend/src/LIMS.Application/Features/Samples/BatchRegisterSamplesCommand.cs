using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.Samples;

public record BatchSampleEntry(
    int MaterialId, string LotNumber,
    DateOnly? MfgDate, DateOnly ExpDate,
    int SampleTypeId,
    decimal? ReceivedTemp = null,
    string? SampleCondition = null,
    bool IsRush = false,
    string? ExternalBatchId = null);

public record BatchRegisterSamplesCommand(
    int LabId, int AnalystId, string CreatedBy,
    List<BatchSampleEntry> Entries) : IRequest<Result<BatchRegisterResult>>;

public record BatchSampleRowResult(
    string LotNumber, bool Success,
    string? SampleNumber, string? Error);

public record BatchRegisterResult(
    int TotalRows, int SuccessCount, int FailCount,
    List<BatchSampleRowResult> Rows);

public class BatchRegisterSamplesHandler : IRequestHandler<BatchRegisterSamplesCommand, Result<BatchRegisterResult>>
{
    private readonly ILimsDbContext _db;
    private readonly ISampleIdFormatService _sampleIdFormat;
    private readonly IFormTemplateSelectorService _templateSelector;
    private readonly IMasterDataAuditService _audit;

    public BatchRegisterSamplesHandler(ILimsDbContext db, ISampleIdFormatService sampleIdFormat,
        IFormTemplateSelectorService templateSelector, IMasterDataAuditService audit)
    { _db = db; _sampleIdFormat = sampleIdFormat; _templateSelector = templateSelector; _audit = audit; }

    public async Task<Result<BatchRegisterResult>> Handle(BatchRegisterSamplesCommand cmd, CancellationToken ct)
    {
        var rows = new List<BatchSampleRowResult>();
        int success = 0, fail = 0;

        foreach (var entry in cmd.Entries)
        {
            // Validate required fields
            if (string.IsNullOrWhiteSpace(entry.LotNumber))
            { rows.Add(new BatchSampleRowResult("(blank)", false, null, "Lot number is required.")); fail++; continue; }

            if (entry.ExpDate <= entry.MfgDate)
            { rows.Add(new BatchSampleRowResult(entry.LotNumber, false, null, "Expiry date must be after manufacturing date.")); fail++; continue; }

            var material = await _db.Materials.FirstOrDefaultAsync(m => m.MaterialId == entry.MaterialId && m.IsActive, ct);
            if (material is null)
            { rows.Add(new BatchSampleRowResult(entry.LotNumber, false, null, "Material not found or inactive.")); fail++; continue; }

            var sampleType = await _db.SampleTypes.FirstOrDefaultAsync(t => t.SampleTypeId == entry.SampleTypeId && t.IsActive, ct);
            if (sampleType is null)
            { rows.Add(new BatchSampleRowResult(entry.LotNumber, false, null, "Sample type not found.")); fail++; continue; }

            try
            {
                var now = DateTimeOffset.UtcNow;
                var sampleNumber = await _sampleIdFormat.GenerateAsync(cmd.LabId, entry.MaterialId, sampleType.TypeCode, entry.LotNumber, ct: ct);

                var sample = new Sample
                {
                    SampleNumber     = sampleNumber,
                    LabId            = cmd.LabId,
                    MaterialId       = entry.MaterialId,
                    LotNumber        = entry.LotNumber,
                    MfgDate          = entry.MfgDate,
                    ExpDate          = entry.ExpDate,
                    SampleTypeId     = entry.SampleTypeId,
                    AnalystId        = cmd.AnalystId,
                    ReceivedTemp     = entry.ReceivedTemp,
                    SampleCondition  = entry.SampleCondition ?? "OK",
                    IsRush           = entry.IsRush,
                    ExternalBatchId  = entry.ExternalBatchId,
                    Status           = SampleStatus.Registered,
                    BarcodePrinted   = true,
                    BarcodePrintedAt = now,
                    CreatedBy        = cmd.CreatedBy,
                    CreatedAt        = now,
                };

                sample.FormTemplateId = await _templateSelector.SelectAsync(cmd.LabId, entry.MaterialId, ct);

                var tatConfig = await _db.LabConfigs
                    .FirstOrDefaultAsync(c => c.LabId == cmd.LabId && c.ConfigKey == "sample_tat_hours", ct);
                if (tatConfig is not null && int.TryParse(tatConfig.ConfigValue, out var tatHours))
                    sample.DueDate = now.AddHours(tatHours);

                _db.Samples.Add(sample);
                _db.BarcodePrintLogs.Add(new BarcodePrintLog
                {
                    Sample    = sample,
                    PrintType = "AutoOnRegistration",
                    PrintedBy = cmd.CreatedBy,
                    PrintedAt = now,
                });

                await _db.SaveChangesAsync(ct);

                await _audit.LogAsync("Sample", sample.SampleId, "BatchRegistered", null,
                    new { sample.SampleNumber, sample.LotNumber, material.MaterialName }, cmd.CreatedBy);

                rows.Add(new BatchSampleRowResult(entry.LotNumber, true, sampleNumber, null));
                success++;
            }
            catch (Exception ex)
            {
                rows.Add(new BatchSampleRowResult(entry.LotNumber, false, null, ex.Message));
                fail++;
            }
        }

        return Result<BatchRegisterResult>.Success(new BatchRegisterResult(cmd.Entries.Count, success, fail, rows));
    }
}
