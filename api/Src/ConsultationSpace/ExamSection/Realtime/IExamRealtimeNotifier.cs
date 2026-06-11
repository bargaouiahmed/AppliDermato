namespace api.Src.ConsultationSpace.ExamSection.Realtime;

public interface IExamRealtimeNotifier
{
    Task NotifyExamUpdated(ExamRealtimeEvent payload);
}
