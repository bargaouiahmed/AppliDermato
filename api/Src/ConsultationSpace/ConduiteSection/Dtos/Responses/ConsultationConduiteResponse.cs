using System.Text.Json;

namespace api.Src.ConsultationSpace.ConduiteSection.Dtos.Responses;

public class ConsultationConduiteResponse
{
    public Guid ConsultationId { get; set; }
    public string AdditionalInformation { get; set; } = string.Empty;
    public List<ConsultationConduiteActionResponse> Actions { get; set; } = [];
}

public class ConsultationConduiteActionResponse
{
    public Guid Id { get; set; }
    public string ActionKey { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public Dictionary<string, JsonElement> Payload { get; set; } = [];
}
