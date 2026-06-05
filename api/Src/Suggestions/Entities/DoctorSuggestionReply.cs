using api.DatabaseRules;
using api.Src.Auth.Entities;

namespace api.Src.Suggestions.Entities;

public class DoctorSuggestionReply : BaseEntity
{
    public Guid Id { get; set; }
    public Guid DoctorSuggestionId { get; set; }
    public DoctorSuggestion? Suggestion { get; set; }
    public Guid ResponderDoctorId { get; set; }
    public Doctor? ResponderDoctor { get; set; }
    public string ResponderFirstName { get; set; } = string.Empty;
    public string ResponderLastName { get; set; } = string.Empty;
    public string ResponderRole { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public bool ReadByDoctor { get; set; }
    public DateTime? ReadByDoctorAt { get; set; }
}
