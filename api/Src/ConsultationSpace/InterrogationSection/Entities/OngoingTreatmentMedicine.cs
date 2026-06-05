using api.DatabaseRules;

namespace api.Src.ConsultationSpace.InterrogationSection.Entities;

public class OngoingTreatmentMedicine : BaseEntity
{
    public Guid Id { get; set; }
    public Guid ConsultationId { get; set; }
    public string Medicine { get; set; } = string.Empty;
    public string TherapeuticClass { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string Posology { get; set; } = string.Empty;
    public string Duration { get; set; } = string.Empty;
    public string Date { get; set; } = string.Empty;

    public Interrogatoire Interrogatoire { get; set; } = null!;
}
