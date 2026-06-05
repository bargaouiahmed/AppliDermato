using api.Src.ConsultationSpace.DocumentsSection.Dtos.Requests;
using api.Src.ConsultationSpace.DocumentsSection.Dtos.Responses;

namespace api.Src.ConsultationSpace.DocumentsSection.Services;

public interface IConsultationDocumentsService
{
    Task<ConsultationDocumentsResponse> GetConsultationDocuments(Guid consultationId, Guid cabinetIdentityId);
    Task<ConsultationExplorationDocumentResponse> CreateExplorationDocument(
        Guid consultationId,
        CreateExplorationDocumentRequest request,
        Guid cabinetIdentityId);
    Task DeleteExplorationDocument(Guid consultationId, Guid documentId, Guid cabinetIdentityId);
}
