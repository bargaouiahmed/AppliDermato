using api.DatabaseRules;

namespace api.Src.ConsultationSpace.ConduiteSection.Entities;

public class ConduiteOrdonnanceTypeCatalogItem : BaseEntity
{
    public Guid Id { get; set; }
    public Guid CabinetIdentityId { get; set; }
    public string TypeKey { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string LabelNormalized { get; set; } = string.Empty;
    public string Consigne { get; set; } = string.Empty;
    public string InformationAdditionnel { get; set; } = string.Empty;
    public List<ConduiteOrdonnanceTypeDrugCatalogItem> ListDrugs { get; set; } = [];
}

public class ConduiteOrdonnanceTypeDrugCatalogItem
{
    public string TherapeuticClass { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string Medicine { get; set; } = string.Empty;
    public string Posology { get; set; } = string.Empty;
    public string Duration { get; set; } = string.Empty;
}
