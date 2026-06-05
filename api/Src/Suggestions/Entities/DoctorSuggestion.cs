using api.DatabaseRules;
using api.Src.Auth.Entities;

namespace api.Src.Suggestions.Entities;

public class DoctorSuggestion : BaseEntity
{
    public Guid Id { get; set; }
    public Guid CabinetIdentityId { get; set; }
    public CabinetIdentity? CabinetIdentity { get; set; }
    public Guid DoctorId { get; set; }
    public string DoctorFirstName { get; set; } = string.Empty;
    public string DoctorLastName { get; set; } = string.Empty;
    public string DoctorEmail { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string Status { get; set; } = SuggestionStatuses.Open;
    public bool SeenByAdmins { get; set; }
    public DateTime? SeenByAdminsAt { get; set; }
    public DateTime? LastReplyAt { get; set; }
    public ICollection<DoctorSuggestionReply> Replies { get; set; } = [];
}

public static class SuggestionStatuses
{
    public const string Open = "open";
    public const string Answered = "answered";
}
