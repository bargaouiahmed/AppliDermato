namespace api.Src.ConsultationSpace.InterrogationSection.Dtos.Requests;

public class UpdateConsultationTimerRequest
{
    public int DurationSeconds { get; set; }
    public bool IsTimerPaused { get; set; }
    public bool IsDone { get; set; }
}
