using System.Text.Json;

namespace api.Src.ConsultationSpace.ExamSection.Dtos.Requests;

public class UpsertConsultationExamRequest
{
    public Dictionary<string, JsonElement> Payload { get; set; } = [];
}
