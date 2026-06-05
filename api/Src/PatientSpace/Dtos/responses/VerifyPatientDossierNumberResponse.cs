namespace api.Src.PatientSpace.Dtos.responses;

public class VerifyPatientDossierNumberResponse
{
    public bool IsUsed { get; set; }
    public string Message { get; set; } = string.Empty;
}
