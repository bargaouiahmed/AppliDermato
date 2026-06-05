using api.Src.ConsultationSpace.ConduiteSection.Dtos.Requests;
using api.Src.ConsultationSpace.ConduiteSection.Dtos.Responses;

namespace api.Src.ConsultationSpace.ConduiteSection.Services;

public interface IConduiteService
{
    Task<List<ConduiteCatalogItemResponse>> GetConduiteCatalog();
    Task<List<string>> GetConsigneCatalog(Guid cabinetIdentityId);
    Task<List<ConduiteOrdonnanceTypeCatalogItemResponse>> GetOrdonnanceTypeCatalog(Guid cabinetIdentityId);
    Task<ConduiteOrdonnanceTypeCatalogItemResponse> SaveOrdonnanceTypeCatalogItem(
        Guid cabinetIdentityId,
        SaveOrdonnanceTypeCatalogItemRequest request);
    Task<ConsultationConduiteResponse> GetConsultationConduite(Guid consultationId, Guid cabinetIdentityId);
    Task<ConsultationConduiteActionResponse?> GetLatestPreviousOrdonnance(
        Guid consultationId,
        Guid cabinetIdentityId);
    Task<ConsultationConduiteResponse> UpsertConsultationConduite(
        Guid consultationId,
        UpsertConsultationConduiteRequest request,
        Guid cabinetIdentityId);
}
