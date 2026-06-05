namespace api.Src.ConsultationSpace.DocumentsSection.Dtos.Responses;

public class ConsultationDocumentsResponse
{
    public Guid ConsultationId { get; set; }
    public List<ConsultationExplorationDocumentResponse> ExplorationDocuments { get; set; } = [];
}

public class ConsultationExplorationDocumentResponse
{
    public Guid Id { get; set; }
    public Guid ConsultationId { get; set; }
    public List<string> TypeLabels { get; set; } = [];
    public string Clinic { get; set; } = string.Empty;
    public string Forfait { get; set; } = string.Empty;
    public string Operator { get; set; } = string.Empty;
    public string Precaution { get; set; } = string.Empty;
    public string AdditionalInformation { get; set; } = string.Empty;
    public string OriginalFileName { get; set; } = string.Empty;
    public string FileUrl { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long FileSizeBytes { get; set; }
    public DateTime CreatedAt { get; set; }
}
