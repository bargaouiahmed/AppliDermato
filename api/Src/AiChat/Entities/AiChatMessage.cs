using api.DatabaseRules;

namespace api.Src.AiChat.Entities;

public class AiChatMessage : BaseEntity
{
    public Guid Id { get; set; }
    public Guid AiChatSessionId { get; set; }
    public AiChatSession? Session { get; set; }
    public string Role { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string Status { get; set; } = "ready";
    public string Error { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public DateTime? DeletedAt { get; set; }
}
