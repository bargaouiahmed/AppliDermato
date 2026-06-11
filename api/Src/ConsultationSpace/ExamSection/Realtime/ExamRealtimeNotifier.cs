using Microsoft.AspNetCore.SignalR;

namespace api.Src.ConsultationSpace.ExamSection.Realtime;

public sealed class ExamRealtimeNotifier(IHubContext<ExamRealtimeHub> hubContext) : IExamRealtimeNotifier
{
    public Task NotifyExamUpdated(ExamRealtimeEvent payload)
        => hubContext.Clients
            .Group(ExamRealtimeHub.BuildCabinetGroup(payload.CabinetIdentityId))
            .SendAsync("examUpdated", payload);
}
