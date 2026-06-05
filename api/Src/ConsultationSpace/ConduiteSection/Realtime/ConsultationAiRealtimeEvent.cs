using api.Src.ConsultationSpace.ConduiteSection;

namespace api.Src.ConsultationSpace.ConduiteSection.Realtime;

public sealed class ConsultationAiRealtimeEvent
{
    public string Type { get; init; } = "consultation-ai-job-updated";
    public Guid CabinetIdentityId { get; init; }
    public Guid ConsultationId { get; init; }
    public Guid JobId { get; init; }
    public string ActionKey { get; init; } = ConduiteActionKeys.LettreConfrere;
    public string Operation { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public string Error { get; init; } = string.Empty;
    public DateTime OccurredAtUtc { get; init; } = DateTime.UtcNow;
}
