using api.DatabaseRules;
using api.Src.ConsultationSpace.Entities;

namespace api.Src.ConsultationSpace.DocumentsSection.Entities;

public class ConsultationExplorationDocument : BaseEntity
{
    public Guid Id { get; set; }
    public Guid ConsultationId { get; set; }
    public string[] TypeLabels { get; set; } = [];
    public string Clinic { get; set; } = string.Empty;
    public string Forfait { get; set; } = string.Empty;
    public string Operator { get; set; } = string.Empty;
    public string Precaution { get; set; } = string.Empty;
    public string AdditionalInformation { get; set; } = string.Empty;
    public string OriginalFileName { get; set; } = string.Empty;
    public string StoredFileName { get; set; } = string.Empty;
    public string RelativeFilePath { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long FileSizeBytes { get; set; }

    public Consultation Consultation { get; set; } = null!;
}
