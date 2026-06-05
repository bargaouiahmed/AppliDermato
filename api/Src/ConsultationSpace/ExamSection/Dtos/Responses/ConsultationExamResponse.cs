using System.Text.Json;

namespace api.Src.ConsultationSpace.ExamSection.Dtos.Responses;

public class ConsultationExamResponse
{
    public Guid ConsultationId { get; set; }
    public Dictionary<string, JsonElement> Payload { get; set; } = [];
}
