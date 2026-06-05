namespace api.Src.PatientSpace.Dtos.responses;

public class ListPatientConsultationsResponse
{
    public List<PatientConsultationResponse> Consultations { get; set; } = [];
    public int TotalCount { get; set; }
}
