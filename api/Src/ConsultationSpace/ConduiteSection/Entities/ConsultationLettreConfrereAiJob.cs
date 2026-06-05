using System.Text.Json;
using api.DatabaseRules;
using api.Src.ConsultationSpace.Entities;

namespace api.Src.ConsultationSpace.ConduiteSection.Entities;

public static class LettreConfrereAiJobOperations
{
    public const string Generate = "generate";
    public const string Correct = "correct";
}

public static class LettreConfrereAiJobStatuses
{
    public const string Queued = "queued";
    public const string Processing = "processing";
    public const string Completed = "completed";
    public const string Failed = "failed";
}

public class ConsultationLettreConfrereAiJob : BaseEntity
{
    public Guid Id { get; set; }
    public Guid ConsultationId { get; set; }
    public Guid CabinetIdentityId { get; set; }
    public string Operation { get; set; } = LettreConfrereAiJobOperations.Generate;
    public string Status { get; set; } = LettreConfrereAiJobStatuses.Queued;
    public string LetterName { get; set; } = string.Empty;
    public string GeneralDescription { get; set; } = string.Empty;
    public string CorrectionPrompt { get; set; } = string.Empty;
    public string SourceContent { get; set; } = string.Empty;
    public string Medecin { get; set; } = string.Empty;
    public string Formulepolitesse { get; set; } = string.Empty;
    public Dictionary<string, JsonElement> ResultPayload { get; set; } = [];
    public string Error { get; set; } = string.Empty;
    public DateTime? StartedAtUtc { get; set; }
    public DateTime? CompletedAtUtc { get; set; }

    public Consultation Consultation { get; set; } = null!;
}
