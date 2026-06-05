namespace api.Src.ConsultationSpace.InterrogationSection.Dtos.Requests;

public class UpsertTreatmentCatalogItemRequest
{
    public string Label { get; set; } = string.Empty;
    public string TherapeuticClass { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
}
