using Microsoft.AspNetCore.SignalR;

namespace api.Src.ConsultationSpace.ConduiteSection.Realtime;

public sealed class ConsultationAiNotifier(IHubContext<ConsultationAiHub> hubContext) : IConsultationAiNotifier
{
    public Task NotifyJobUpdated(ConsultationAiRealtimeEvent payload)
        => hubContext.Clients
            .Group(ConsultationAiHub.BuildCabinetGroup(payload.CabinetIdentityId))
            .SendAsync("consultationAiJobUpdated", payload);
}
