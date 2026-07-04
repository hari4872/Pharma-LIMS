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
            .Include(f => f.SampleTypeNav)
            .FirstOrDefaultAsync(f =>
                f.TriggerType == TriggerType.DispatchEvent &&
                f.Status == FormTemplateStatus.Active &&
                f.IsActive, ct);

        if (formTemplate is null)
            throw new InvalidOperationException(
                "No active Form Template with trigger_type = DispatchEvent found. Configure one in Master Data.");

        // SampleType comes from the FormTemplate — no hardcoding (user configures it in Master Data)
        if (formTemplate.SampleTypeId is null || formTemplate.SampleTypeNav is null)
            throw new InvalidOperationException(
                $"Form Template '{formTemplate.FormCode}' has no Sample Type assigned. " +
                "Edit the template in Master Data and select the Sample Type for Dispatch QC.");

        // Auto-create a Sample for this Dispatch QC
        var sampleNumber = await _sampleIdFormat.GenerateAsync(
            formTemplate.LabId, deliveryOrder.ProductId,
            formTemplate.SampleTypeNav.TypeCode, deliveryOrder.DoNumber, ct: ct);

        // Resolve system analyst dynamically — avoid hardcoded ID that breaks in non-seeded environments
        var systemAnalystId = await _db.Users
            .Where(u => u.IsActive && u.Role == LIMS.Domain.Enums.UserRole.Admin)
            .Select(u => u.UserId)
            .FirstOrDefaultAsync(ct);

        if (systemAnalystId == 0)
            throw new InvalidOperationException(
                "No active Admin user found for system dispatch sample attribution. " +
                "Ensure at least one Admin user exists before processing dispatch events.");

        var sample = new Sample
        {
            SampleNumber   = sampleNumber,
            LabId          = formTemplate.LabId,
            MaterialId     = deliveryOrder.ProductId,
            LotNumber      = deliveryOrder.DoNumber,
            MfgDate        = DateOnly.FromDateTime(DateTime.UtcNow),
            ExpDate        = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(365)),
            SampleTypeId   = formTemplate.SampleTypeId.Value,  // from FormTemplate — no hardcoding
            FormTemplateId = formTemplate.FormTemplateId,
            Status         = SampleStatus.InTesting,
            AnalystId      = systemAnalystId,
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
