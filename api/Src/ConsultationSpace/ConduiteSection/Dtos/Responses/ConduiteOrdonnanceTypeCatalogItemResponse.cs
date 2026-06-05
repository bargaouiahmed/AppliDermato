namespace api.Src.ConsultationSpace.ConduiteSection.Dtos.Responses;

public class ConduiteOrdonnanceTypeCatalogItemResponse
{
    public string TypeKey { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string TranslationKey { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public string Consigne { get; set; } = string.Empty;
    public string InformationAdditionnel { get; set; } = string.Empty;
    public List<ConduiteOrdonnanceTypeDrugResponse> ListDrugs { get; set; } = [];
}

public class ConduiteOrdonnanceTypeDrugResponse
{
    public string TherapeuticClass { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string Medicine { get; set; } = string.Empty;
    public string Posology { get; set; } = string.Empty;
    public string Duration { get; set; } = string.Empty;
}