using api.DatabaseRules;
using api.Src.Auth.Entities;

namespace api.Src.TechAssistance.Entities;

public class TechAssistanceTicket : BaseEntity
{
    public Guid Id { get; set; }
    public Guid CabinetIdentityId { get; set; }
    public CabinetIdentity? CabinetIdentity { get; set; }
    public Guid DoctorId { get; set; }
    public string DoctorFirstName { get; set; } = string.Empty;
    public string DoctorLastName { get; set; } = string.Empty;
    public string DoctorEmail { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public string Status { get; set; } = TechAssistanceStatuses.Open;
    public bool SeenByAdmins { get; set; }
    public DateTime? SeenByAdminsAt { get; set; }
    public DateTime? LastMessageAt { get; set; }
    public DateTime? LastDoctorMessageAt { get; set; }
    public DateTime? LastAdminMessageAt { get; set; }
    public DateTime? TechLeadNotifiedAt { get; set; }
    public ICollection<TechAssistanceMessage> Messages { get; set; } = [];
}

public static class TechAssistanceStatuses
{
    public const string Open = "open";
    public const string Answered = "answered";
    public const string Escalated = "escalated";
    public const string Closed = "closed";
}
