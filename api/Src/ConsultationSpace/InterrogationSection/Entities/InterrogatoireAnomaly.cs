using System.Text.Json;
using api.DatabaseRules;

namespace api.Src.ConsultationSpace.InterrogationSection.Entities;

public class InterrogatoireAnomaly : BaseEntity
{
    public Guid Id { get; set; }
    public Guid ConsultationId { get; set; }
    public InterrogatoireAnomalySection Section { get; set; }

    public bool IsCustom { get; set; }
    public string? TemplateKey { get; set; }
    public int SortOrder { get; set; }
    public Dictionary<string, JsonElement> Payload { get; set; } = [];

    public Interrogatoire Interrogatoire { get; set; } = null!;
}

public enum InterrogatoireAnomalySection
{
    Medical = 1,
    Family = 2,
    Surgical = 3
}
