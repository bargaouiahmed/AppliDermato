using System.Text.Json;

namespace api.Src.ConsultationSpace.InterrogationSection.Dtos.Responses;

public class ConsultationInterrogatoireResponse
{
    public Guid ConsultationId { get; set; }
    public Guid PatientId { get; set; }
    public Guid CabinetIdentityId { get; set; }
    public DateTime ConsultationDate { get; set; }
    public string Duration { get; set; } = "00:00:00";
    public bool IsTimerPaused { get; set; }
    public bool IsDone { get; set; }
    public List<string> Motifs { get; set; } = [];
    public string HistoireMaladie { get; set; } = string.Empty;
    public List<string> Diagnostics { get; set; } = [];
    public bool CopiedFromPreviousConsultation { get; set; }
    public Guid? SourceConsultationId { get; set; }
    public List<InterrogatoireAnomalyResponse> Anomalies { get; set; } = [];
    public List<OngoingTreatmentMedicineResponse> OngoingTreatments { get; set; } = [];
}

public class InterrogatoireAnomalyResponse
{
    public Guid Id { get; set; }
    public string Section { get; set; } = string.Empty;
    public bool IsCustom { get; set; }
    public string? TemplateKey { get; set; }
    public int SortOrder { get; set; }
    public Dictionary<string, JsonElement> Payload { get; set; } = [];
}

public class OngoingTreatmentMedicineResponse
{
    public Guid Id { get; set; }
    public string Medicine { get; set; } = string.Empty;
    public string TherapeuticClass { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string Posology { get; set; } = string.Empty;
    public string Duration { get; set; } = string.Empty;
    public string Date { get; set; } = string.Empty;
}
