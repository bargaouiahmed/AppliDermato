using api.DatabaseRules;
using api.Src.Auth.Entities;

namespace api.Src.AiChat.Entities;

public class AiChatSession : BaseEntity
{
    public Guid Id { get; set; }
    public Guid CabinetIdentityId { get; set; }
    public CabinetIdentity? CabinetIdentity { get; set; }
    public string Title { get; set; } = "Nouvelle discussion";
    public string Context { get; set; } = string.Empty;
    public DateTime? DeletedAt { get; set; }
    public List<AiChatMessage> Messages { get; set; } = [];
}
