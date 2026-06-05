namespace api.Src.PatientSpace.Dtos.responses;

public class DailyConsultationResponse
{
    public Guid Id { get; set; }
    public Guid PatientId { get; set; }
    public int PatientDossierNumber { get; set; }
    public string PatientFirstname { get; set; } = string.Empty;
    public string PatientLastname { get; set; } = string.Empty;
    public string PatientProfession { get; set; } = string.Empty;
    public int PatientAge { get; set; }
    public int PatientConsultationCount { get; set; }
    public DateTime ConsultationDate { get; set; }
    public string Duration { get; set; } = "00:00:00";
    public bool IsTimerPaused { get; set; }
    public bool IsDone { get; set; }
    public string Status { get; set; } = "consultation_not_started";
    public List<string> Motifs { get; set; } = [];
}
