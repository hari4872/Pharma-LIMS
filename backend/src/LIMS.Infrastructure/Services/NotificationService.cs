using LIMS.Application.Interfaces;
using LIMS.Infrastructure.Hubs;
using Microsoft.AspNetCore.SignalR;

namespace LIMS.Infrastructure.Services;

// Contract 2: all push server-side via SignalR hub
public class NotificationService : INotificationService
{
    private readonly IHubContext<LimsHub> _hub;
    public NotificationService(IHubContext<LimsHub> hub) => _hub = hub;

    public Task PushToGroupAsync(string group, string eventName, object payload, CancellationToken cancellationToken = default)
        => _hub.Clients.Group(group).SendAsync(eventName, payload, cancellationToken);

    public Task PushToUserAsync(int userId, string eventName, object payload, CancellationToken cancellationToken = default)
        => _hub.Clients.Group($"user-{userId}").SendAsync(eventName, payload, cancellationToken);

    public Task PushToAllAsync(string eventName, object payload, CancellationToken cancellationToken = default)
        => _hub.Clients.All.SendAsync(eventName, payload, cancellationToken);
}
