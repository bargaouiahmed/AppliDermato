using api.DatabaseRules;

namespace api.Src.ConsultationSpace.ExamSection.Entities;

public class ExamFindingCatalogItem : BaseEntity
{
    public Guid Id { get; set; }
    public Guid CabinetIdentityId { get; set; }
    public string Section { get; set; } = string.Empty;
    public string SectionNormalized { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string LabelNormalized { get; set; } = string.Empty;
}
