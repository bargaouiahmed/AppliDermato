using api.Src.ConsultationSpace.ExamSection.Dtos.Requests;
using api.Src.ConsultationSpace.ExamSection.Dtos.Responses;

namespace api.Src.ConsultationSpace.ExamSection.Services;

public interface IExamService
{
    Task<ConsultationExamResponse> GetConsultationExam(Guid consultationId, Guid cabinetIdentityId);
    Task<ConsultationExamResponse> UpsertConsultationExam(Guid consultationId, UpsertConsultationExamRequest request, Guid cabinetIdentityId);
    Task<List<ExamFindingCatalogItemResponse>> GetFindingCatalog(Guid cabinetIdentityId, string? section);
    Task<ExamFindingCatalogItemResponse> AddFindingCatalogItem(Guid cabinetIdentityId, UpsertExamFindingCatalogItemRequest request);
}
