using System.Text.Json;
using api.Src.ConsultationSpace.ConduiteSection;

namespace api.Src.ConsultationSpace.ConduiteSection.Dtos.Responses;

public sealed class LettreConfrereAiJobResponse
{
    public Guid Id { get; set; }
    public Guid ConsultationId { get; set; }
    public string Operation { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string ActionKey { get; set; } = ConduiteActionKeys.LettreConfrere;
    public Dictionary<string, JsonElement> ResultPayload { get; set; } = [];
    public string Error { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime? CompletedAtUtc { get; set; }
}
