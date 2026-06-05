namespace api.Src.ConsultationSpace.InterrogationSection.Dtos.Requests;

public class UpsertAnomalyCatalogCustomRequest
{
    public string Section { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string? TemplateKey { get; set; }
}
