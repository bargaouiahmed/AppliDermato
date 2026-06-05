namespace api.Src.ConsultationSpace.ExamSection.Dtos.Responses;

public class ExamFindingCatalogItemResponse
{
    public string Section { get; set; } = string.Empty;
    public bool IsCustom { get; set; }
    public string Label { get; set; } = string.Empty;
}
