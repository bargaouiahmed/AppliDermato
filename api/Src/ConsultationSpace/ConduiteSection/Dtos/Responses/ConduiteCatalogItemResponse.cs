namespace api.Src.ConsultationSpace.ConduiteSection.Dtos.Responses;

public class ConduiteCatalogItemResponse
{
    public string ActionKey { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public bool IsParaclinique { get; set; }
}
