using api.DatabaseRules;
using api.Src.Auth.Entities;

namespace api.Src.Messaging.Entities;

public class InternalMessage : BaseEntity
{
    public Guid Id { get; set; }
    public Guid CabinetIdentityId { get; set; }
    public CabinetIdentity? CabinetIdentity { get; set; }
    public string RoomId { get; set; } = string.Empty;
    public string Sender { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public DateTime? EditedAt { get; set; }
    public DateTime? DeletedAt { get; set; }
    public string[] SeenBy { get; set; } = [];
    public bool IsRead { get; set; }
}
