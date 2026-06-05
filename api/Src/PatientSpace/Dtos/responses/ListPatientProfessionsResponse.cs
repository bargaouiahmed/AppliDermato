namespace api.Src.PatientSpace.Dtos.responses;

public class ListPatientProfessionsResponse
{
    public List<string> Professions { get; set; } = [];
    public int TotalCount { get; set; }
}
