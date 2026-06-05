using api.Src.Auth.Helpers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace api.Src.Suggestions.Realtime;

[Authorize(Roles = "doctor,admin,super_admin")]
public class SuggestionHub : Hub
{
    public const string HubPath = "/hubs/suggestions";
    public const string AdminsGroup = "suggestions:admins";

    public override async Task OnConnectedAsync()
    {
        var role = Context.User?.GetRoleOrThrow()?.Trim().ToLowerInvariant() ?? string.Empty;
        var cabinetIdentityId = Context.User?.GetCabinetIdentityId()
            ?? throw new InvalidOperationException("Cabinet identity claim not found.");

        await Groups.AddToGroupAsync(Context.ConnectionId, BuildDoctorGroup(cabinetIdentityId));

        if (role is "admin" or "super_admin")
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, AdminsGroup);
        }

        await base.OnConnectedAsync();
    }

    public static string BuildDoctorGroup(Guid cabinetIdentityId)
        => $"suggestions:doctor:{cabinetIdentityId:D}";
}
