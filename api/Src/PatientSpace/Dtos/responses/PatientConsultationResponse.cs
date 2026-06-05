namespace api.Src.PatientSpace.Dtos.responses;

public class PatientConsultationResponse
{
    public Guid Id { get; set; }
    public DateTime ConsultationDate { get; set; }
    public string Duration { get; set; } = "00:00:00";
    public bool IsTimerPaused { get; set; }
    public bool IsDone { get; set; }
    public List<string> Motifs { get; set; } = [];
    public List<string> Diagnostics { get; set; } = [];
    public List<string> ConduiteActions { get; set; } = [];
}
