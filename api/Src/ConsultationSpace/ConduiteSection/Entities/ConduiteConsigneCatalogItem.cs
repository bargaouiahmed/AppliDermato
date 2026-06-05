using api.DatabaseRules;

namespace api.Src.ConsultationSpace.ConduiteSection.Entities;

public class ConduiteConsigneCatalogItem : BaseEntity
{
    public Guid Id { get; set; }
    public Guid CabinetIdentityId { get; set; }
    public string Label { get; set; } = string.Empty;
    public string LabelNormalized { get; set; } = string.Empty;
}