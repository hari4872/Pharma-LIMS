using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace LIMS.Infrastructure.Hubs;

// Contract 2: all real-time push via SignalR — React does NOT poll
[Authorize]
public class LimsHub : Hub
{
    public async Task JoinGroup(string groupName)
        => await Groups.AddToGroupAsync(Context.ConnectionId, groupName);

    public async Task LeaveGroup(string groupName)
        => await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);
}
