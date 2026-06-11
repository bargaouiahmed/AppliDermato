using api.Src.Auth.Helpers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace api.Src.ConsultationSpace.ExamSection.Realtime;

[Authorize]
public class ExamRealtimeHub : Hub
{
    public const string HubPath = "/hubs/exam";

    public override async Task OnConnectedAsync()
    {
        var cabinetIdentityId = Context.User?.GetCabinetIdentityId()
            ?? throw new InvalidOperationException("Cabinet identity claim not found.");

        await Groups.AddToGroupAsync(Context.ConnectionId, BuildCabinetGroup(cabinetIdentityId));
        await base.OnConnectedAsync();
    }

    public static string BuildCabinetGroup(Guid cabinetIdentityId)
        => $"exam:{cabinetIdentityId:D}";
}
