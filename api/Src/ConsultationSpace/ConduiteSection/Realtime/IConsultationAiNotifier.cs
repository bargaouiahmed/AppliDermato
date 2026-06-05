namespace api.Src.ConsultationSpace.ConduiteSection.Realtime;

public interface IConsultationAiNotifier
{
    Task NotifyJobUpdated(ConsultationAiRealtimeEvent payload);
}
