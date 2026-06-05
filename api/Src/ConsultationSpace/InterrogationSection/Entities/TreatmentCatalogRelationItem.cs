using api.DatabaseRules;

namespace api.Src.ConsultationSpace.InterrogationSection.Entities;

public class TreatmentCatalogRelationItem : BaseEntity
{
    public Guid Id { get; set; }
    public Guid CabinetIdentityId { get; set; }
    public string TherapeuticClass { get; set; } = string.Empty;
    public string TherapeuticClassNormalized { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string CategoryNormalized { get; set; } = string.Empty;
    public string Medicine { get; set; } = string.Empty;
    public string MedicineNormalized { get; set; } = string.Empty;
}
