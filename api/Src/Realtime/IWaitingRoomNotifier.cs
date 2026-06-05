namespace api.Src.Realtime;

public interface IWaitingRoomNotifier
{
    Task NotifyCabinetUpdated(Guid cabinetIdentityId, Guid? consultationId, string eventType);
}
