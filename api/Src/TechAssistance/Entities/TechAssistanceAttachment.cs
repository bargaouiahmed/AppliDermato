using api.DatabaseRules;

namespace api.Src.TechAssistance.Entities;

public class TechAssistanceAttachment : BaseEntity
{
    public Guid Id { get; set; }
    public Guid TechAssistanceMessageId { get; set; }
    public TechAssistanceMessage? Message { get; set; }
    public string OriginalFileName { get; set; } = string.Empty;
    public string StoredFileName { get; set; } = string.Empty;
    public string RelativeFilePath { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long FileSizeBytes { get; set; }
}
