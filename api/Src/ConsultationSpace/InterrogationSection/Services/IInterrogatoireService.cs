using api.Src.ConsultationSpace.InterrogationSection.Dtos.Requests;
using api.Src.ConsultationSpace.InterrogationSection.Dtos.Responses;

namespace api.Src.ConsultationSpace.InterrogationSection.Services;

public interface IInterrogatoireService
{
    Task SeedGeneralPracticeTreatmentCatalogForAllCabinets();
    Task RefreshGeneralPracticeTreatmentCatalogAccentsForAllCabinets();
    Task<ConsultationInterrogatoireResponse> InitializeConsultation(InitializeConsultationRequest request, Guid cabinetIdentityId);
    Task<ConsultationInterrogatoireResponse> GetConsultationInterrogatoire(Guid consultationId, Guid cabinetIdentityId);
    Task<List<InterrogatoireAnomalyCatalogItemResponse>> GetAnomalyCatalog(Guid cabinetIdentityId, string? section);
    Task<InterrogatoireAnomalyCatalogItemResponse> AddCustomAnomalyToCatalog(Guid cabinetIdentityId, UpsertAnomalyCatalogCustomRequest request);
    Task HideCustomAnomalyFromCatalog(Guid cabinetIdentityId, string section, string label);
    Task<List<TreatmentCatalogItemResponse>> GetTreatmentMedicineCatalog(Guid cabinetIdentityId);
    Task<List<TreatmentCatalogItemResponse>> GetTherapeuticClassCatalog(Guid cabinetIdentityId);
    Task<List<TreatmentCatalogItemResponse>> GetTreatmentCategoryCatalog(Guid cabinetIdentityId);
    Task<List<TreatmentCatalogRelationResponse>> GetTreatmentCatalogRelations(Guid cabinetIdentityId);
    Task<List<InterrogatoireOrdonnanceHistoryResponse>> GetPreviousOrdonnanceHistory(Guid consultationId, Guid cabinetIdentityId);
    Task<List<string>> GetDiagnosticsCatalog(Guid consultationId, Guid cabinetIdentityId);
    Task<TreatmentCatalogItemResponse> AddTreatmentMedicineCatalogItem(Guid cabinetIdentityId, UpsertTreatmentCatalogItemRequest request);
    Task<TreatmentCatalogItemResponse> AddTherapeuticClassCatalogItem(Guid cabinetIdentityId, UpsertTreatmentCatalogItemRequest request);
    Task<TreatmentCatalogItemResponse> AddTreatmentCategoryCatalogItem(Guid cabinetIdentityId, UpsertTreatmentCatalogItemRequest request);
    Task UpdateConsultationData(Guid consultationId, UpdateConsultationDataRequest request, Guid cabinetIdentityId, bool updateTreatmentCatalog = true);
    Task UpdateConsultationTimer(Guid consultationId, UpdateConsultationTimerRequest request, Guid cabinetIdentityId);
    Task DeleteConsultation(Guid consultationId, Guid cabinetIdentityId);
}
