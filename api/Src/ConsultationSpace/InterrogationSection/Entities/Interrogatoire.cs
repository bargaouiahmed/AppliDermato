using api.DatabaseRules;
using api.Src.ConsultationSpace.Entities;

namespace api.Src.ConsultationSpace.InterrogationSection.Entities;

public class Interrogatoire : BaseEntity
{
    public Guid ConsultationId { get; set; }
    public string HistoireMaladie { get; set; } = string.Empty;
    public string[] Diagnostics { get; set; } = [];

    public Consultation Consultation { get; set; } = null!;
    public ICollection<InterrogatoireAnomaly> Anomalies { get; set; } = [];
    public ICollection<OngoingTreatmentMedicine> OngoingTreatments { get; set; } = [];
}
