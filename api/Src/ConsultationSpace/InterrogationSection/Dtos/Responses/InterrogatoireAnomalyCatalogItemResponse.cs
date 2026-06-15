namespace api.Src.ConsultationSpace.InterrogationSection.Dtos.Responses;

public class InterrogatoireAnomalyCatalogItemResponse
{
    public string Section { get; set; } = string.Empty;
    public bool IsCustom { get; set; }
    public string? TemplateKey { get; set; }
    public string Category { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
}
