namespace api.Src.ConsultationSpace.ConduiteSection.Dtos.Responses;

public class PrintableConduiteDocumentResponse
{
    public Guid ConsultationId { get; set; }
    public string DocumentType { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string HtmlContent { get; set; } = string.Empty;
}
