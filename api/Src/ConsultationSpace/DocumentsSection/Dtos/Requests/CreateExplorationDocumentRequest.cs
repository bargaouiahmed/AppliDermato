using Microsoft.AspNetCore.Http;

namespace api.Src.ConsultationSpace.DocumentsSection.Dtos.Requests;

public class CreateExplorationDocumentRequest
{
    public List<string> TypeLabels { get; set; } = [];
    public string? Clinic { get; set; }
    public string? Forfait { get; set; }
    public string? Operator { get; set; }
    public string? Precaution { get; set; }
    public string? AdditionalInformation { get; set; }
    public IFormFile? File { get; set; }
}
