namespace LIMS.Application.Interfaces;

// Contract 2: all push via SignalR from server — no polling, no setInterval
public interface INotificationService
{
    Task PushToGroupAsync(string group, string eventName, object payload, CancellationToken cancellationToken = default);
    Task PushToUserAsync(int userId, string eventName, object payload, CancellationToken cancellationToken = default);
    Task PushToAllAsync(string eventName, object payload, CancellationToken cancellationToken = default);
}
