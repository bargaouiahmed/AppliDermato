using Microsoft.AspNetCore.SignalR;

namespace api.Src.Realtime;

public sealed class WaitingRoomNotifier(IHubContext<WaitingRoomHub> hubContext) : IWaitingRoomNotifier
{
    public Task NotifyCabinetUpdated(Guid cabinetIdentityId, Guid? consultationId, string eventType)
    {
        var payload = new WaitingRoomRealtimeEvent
        {
            Type = eventType,
            CabinetIdentityId = cabinetIdentityId,
            ConsultationId = consultationId,
            OccurredAtUtc = DateTime.UtcNow
        };

        return hubContext.Clients
            .Group(WaitingRoomHub.BuildCabinetGroup(cabinetIdentityId))
            .SendAsync("waitingRoomUpdated", payload);
    }
}
