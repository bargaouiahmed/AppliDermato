using api.DatabaseRules;

namespace api.Src.ConsultationSpace.InterrogationSection.Entities;

public class InterrogatoireAnomalyCatalogCustom : BaseEntity
{
    public Guid Id { get; set; }
    public Guid CabinetIdentityId { get; set; }
    public InterrogatoireAnomalySection Section { get; set; }
    public bool IsCustom { get; set; } = true;
    public string? TemplateKey { get; set; }
    public string Category { get; set; } = string.Empty;
    public string CategoryNormalized { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string LabelNormalized { get; set; } = string.Empty;
}
