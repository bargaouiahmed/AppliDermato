using System.Text.Json;

namespace api.Src.ConsultationSpace.InterrogationSection.Dtos.Responses;

public class InterrogatoireOrdonnanceHistoryResponse
{
    public Guid ConsultationId { get; set; }
    public DateTime ConsultationDate { get; set; }
    public Dictionary<string, JsonElement> Payload { get; set; } = [];
}
