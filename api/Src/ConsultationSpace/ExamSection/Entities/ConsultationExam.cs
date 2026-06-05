using System.Text.Json;
using api.DatabaseRules;
using api.Src.ConsultationSpace.Entities;

namespace api.Src.ConsultationSpace.ExamSection.Entities;

public class ConsultationExam : BaseEntity
{
    public Guid ConsultationId { get; set; }
    public Dictionary<string, JsonElement> Payload { get; set; } = [];

    public Consultation Consultation { get; set; } = null!;
}
