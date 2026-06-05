using System.Text.Json;

namespace api.Src.ConsultationSpace.InterrogationSection.Dtos.Requests;

public class UpdateConsultationDataRequest
{
    public List<string> Motifs { get; set; } = [];
    public string HistoireMaladie { get; set; } = string.Empty;
    public List<string> Diagnostics { get; set; } = [];
    public List<UpdateInterrogatoireAnomalyRequest> Anomalies { get; set; } = [];
    public List<UpdateOngoingTreatmentMedicineRequest> OngoingTreatments { get; set; } = [];
}

public class UpdateInterrogatoireAnomalyRequest
{
    public string Section { get; set; } = string.Empty;
    public bool IsCustom { get; set; }
    public string? TemplateKey { get; set; }
    public int SortOrder { get; set; }
    public Dictionary<string, JsonElement> Payload { get; set; } = [];
}

public class UpdateOngoingTreatmentMedicineRequest
{
    public string Medicine { get; set; } = string.Empty;
    public string TherapeuticClass { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string Posology { get; set; } = string.Empty;
    public string Duration { get; set; } = string.Empty;
    public string Date { get; set; } = string.Empty;
}
