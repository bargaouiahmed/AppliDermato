namespace api.Src.ConsultationSpace.InterrogationSection.Dtos.Requests;

public class InitializeConsultationRequest
{
    public Guid PatientId { get; set; }
    public DateTime ConsultationDate { get; set; }
    public List<string> Motifs { get; set; } = [];
}
