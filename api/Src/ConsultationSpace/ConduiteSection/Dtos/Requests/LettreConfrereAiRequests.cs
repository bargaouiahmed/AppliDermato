using System.Text.Json.Serialization;

namespace api.Src.ConsultationSpace.ConduiteSection.Dtos.Requests;

public sealed class GenerateLettreConfrereAiRequest
{
    public string? GeneralDescription { get; set; }
    public string? Medecin { get; set; }

    [JsonPropertyName("contenue")]
    public string? Contenue { get; set; }

    [JsonPropertyName("formulepolitesse")]
    public string? Formulepolitesse { get; set; }
}

public sealed class CorrectLettreConfrereAiRequest
{
    [JsonPropertyName("contenue")]
    public string? Contenue { get; set; }

    public string? CorrectionPrompt { get; set; }
    public string? Medecin { get; set; }

    [JsonPropertyName("formulepolitesse")]
    public string? Formulepolitesse { get; set; }
}
