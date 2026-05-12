namespace LIMS.Application.Interfaces;

// Contract 1: Single DO→task creator — ERP auto-push and manual entry both go through here
public interface IDispatchEventService
{
    /// <summary>
    /// Creates a DispatchQcTask for the delivery order.
    /// Resolves the correct FormTemplate from product_type → form_template_id FK.
    /// </summary>
    Task<int> CreateTaskAsync(int doId, CancellationToken ct = default);
}
