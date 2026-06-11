using System.Text.Json;

namespace api.Src.ConsultationSpace.ExamSection.Realtime;

public sealed class ExamRealtimeEvent
{
    public Guid CabinetIdentityId { get; init; }
    public Guid ConsultationId { get; init; }
    public Dictionary<string, JsonElement> Payload { get; init; } = new(StringComparer.Ordinal);
    public DateTime OccurredAtUtc { get; init; }
}
