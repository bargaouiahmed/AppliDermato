using System.Text.Json;
using api.DatabaseRules;
using api.Src.ConsultationSpace.Entities;

namespace api.Src.ConsultationSpace.ConduiteSection.Entities;

public class ConsultationConduiteAction : BaseEntity
{
    public Guid Id { get; set; }
    public Guid ConsultationId { get; set; }
    public string ActionKey { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public Dictionary<string, JsonElement> Payload { get; set; } = [];

    public Consultation Consultation { get; set; } = null!;
}
