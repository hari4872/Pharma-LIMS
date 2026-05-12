using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Infrastructure.Services;

// Contract 1: Single DO→task creator — same path for ERP auto-push and manual entry
// Test set configurable per product type via Form Template FK (Contract 2 — not hardcoded)
public class DispatchEventService : IDispatchEventService
{
    private readonly ILimsDbContext _db;
    private readonly ISampleIdFormatService _sampleIdFormat;

    public DispatchEventService(ILimsDbContext db, ISampleIdFormatService sampleIdFormat)
    { _db = db; _sampleIdFormat = sampleIdFormat; }

    public async Task<int> CreateTaskAsync(int doId, CancellationToken ct = default)
    {
        var deliveryOrder = await _db.DeliveryOrders
            .Include(d => d.Product)
            .FirstOrDefaultAsync(d => d.DoId == doId, ct)
            ?? throw new InvalidOperationException($"Delivery Order {doId} not found.");

        // Resolve FormTemplate: trigger_type = DispatchEvent, matching product_type (Contract 2)
        var formTemplate = await _db.FormTemplates
            .FirstOrDefaultAsync(f =>
                f.TriggerType == TriggerType.DispatchEvent &&
                f.Status == FormTemplateStatus.Active &&
                f.IsActive, ct);

        if (formTemplate is null)
            throw new InvalidOperationException(
                "No active Form Template with trigger_type = DispatchEvent found. Configure one in Master Data.");

        // Gap 2 fix: resolve SampleTypeId by TypeCode "DSPQC" (must exist in SampleType master)
        var dispatchSampleType = await _db.SampleTypes
            .FirstOrDefaultAsync(t => t.TypeCode == "DSPQC" && t.IsActive, ct)
            ?? throw new InvalidOperationException(
                "SampleType with TypeCode 'DSPQC' not found. Create it in Master Data > Sample Types before raising Delivery Orders.");

        // Auto-create a Sample for this Dispatch QC
        var sampleNumber = await _sampleIdFormat.GenerateAsync(formTemplate.LabId, deliveryOrder.ProductId, dispatchSampleType.TypeCode, deliveryOrder.DoNumber, ct);
        var sample = new Sample
        {
            SampleNumber   = sampleNumber,
            LabId          = formTemplate.LabId,
            MaterialId     = deliveryOrder.ProductId,
            LotNumber      = deliveryOrder.DoNumber,
            MfgDate        = DateOnly.FromDateTime(DateTime.UtcNow),
            ExpDate        = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(365)),
            SampleTypeId   = dispatchSampleType.SampleTypeId,   // Gap 2 fix: FK
            FormTemplateId = formTemplate.FormTemplateId,
            Status         = SampleStatus.InTesting,
            AnalystId      = 1,   // Default system analyst — WAP assigns real analyst
            CreatedBy      = "DispatchEventService"
        };
        _db.Samples.Add(sample);
        await _db.SaveChangesAsync(ct);

        var task = new DispatchQcTask
        {
            DoId           = doId,
            SampleId       = sample.SampleId,
            FormTemplateId = formTemplate.FormTemplateId,
            Status         = DispatchTaskStatus.Open
        };
        _db.DispatchQcTasks.Add(task);

        deliveryOrder.Status = DispatchStatus.InDispatchQC;
        await _db.SaveChangesAsync(ct);

        return task.TaskId;
    }
}
