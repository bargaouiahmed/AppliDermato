namespace api.Src.Realtime;

public sealed class WaitingRoomRealtimeEvent
{
    public string Type { get; init; } = "waiting-room-updated";
    public Guid CabinetIdentityId { get; init; }
    public Guid? ConsultationId { get; init; }
    public DateTime OccurredAtUtc { get; init; } = DateTime.UtcNow;
}
