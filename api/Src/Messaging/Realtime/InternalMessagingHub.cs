using api.Src.Auth.Helpers;
using api.Src.Messaging.Dtos;
using api.Src.Messaging.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace api.Src.Messaging.Realtime;

[Authorize]
public class InternalMessagingHub(InternalMessagingService messagingService) : Hub
{
    public const string HubPath = "/hubs/internal-messaging";

    public override async Task OnConnectedAsync()
    {
        var cabinetIdentityId = Context.User?.GetCabinetIdentityId()
            ?? throw new InvalidOperationException("Cabinet identity claim not found.");

        var rooms = await messagingService.GetAllowedRoomsAsync(cabinetIdentityId, Context.User!);
        foreach (var room in rooms)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, BuildRoomGroup(cabinetIdentityId, room.RoomId));
        }

        await base.OnConnectedAsync();
    }

    public async Task Join(string roomId)
    {
        var cabinetIdentityId = Context.User?.GetCabinetIdentityId()
            ?? throw new InvalidOperationException("Cabinet identity claim not found.");

        await messagingService.EnsureRoomAccessAsync(cabinetIdentityId, roomId, Context.User!);
        await Groups.AddToGroupAsync(Context.ConnectionId, BuildRoomGroup(cabinetIdentityId, roomId));
    }

    public async Task Typing(InternalMessagingTypingPayload payload)
    {
        await BroadcastTypingEvent("typing", payload);
    }

    public async Task StopTyping(InternalMessagingTypingPayload payload)
    {
        await BroadcastTypingEvent("stopTyping", payload);
    }

    public static string BuildRoomGroup(Guid cabinetIdentityId, string roomId)
        => $"internal-message:{cabinetIdentityId:D}:{roomId}";

    private async Task BroadcastTypingEvent(string eventName, InternalMessagingTypingPayload payload)
    {
        var cabinetIdentityId = Context.User?.GetCabinetIdentityId()
            ?? throw new InvalidOperationException("Cabinet identity claim not found.");
        var sender = messagingService.ResolveSender(Context.User!, payload.Sender);

        await messagingService.EnsureRoomAccessAsync(cabinetIdentityId, payload.RoomId, Context.User!, sender);
        await Clients
            .OthersInGroup(BuildRoomGroup(cabinetIdentityId, payload.RoomId))
            .SendAsync(eventName, new { roomId = payload.RoomId, sender });
    }
}
