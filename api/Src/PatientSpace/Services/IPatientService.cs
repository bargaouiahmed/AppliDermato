using System;
using api.Src.PatientSpace.Dtos.requests;
using api.Src.PatientSpace.Dtos.responses;

namespace api.Src.PatientSpace.Services;

public interface IPatientService
{
    public Task AddPatient(AddPatientRequest request, Guid cabinetIdentityId);
    public Task<PatientResponse> GetPatientById(Guid id, Guid cabinetIdentityId);
    public Task UpdatePatient(Guid id, UpdatePateinetRequest request, Guid cabinetIdentityId);
    public Task DeletePatient(Guid id, Guid cabinetIdentityId);
    public Task<ListPatientResponse> GetAllPatientsForCabinet(Guid cabinetIdentityId, int pageNumber, int pageSize, string? searchQuery, string? dateOfBirth, string? sortBy, string? sortDirection, int? dossierNumber = null, string? phoneNumber = null, string? name = null, string? email = null, string? firstname = null, string? lastname = null, int? age = null);
    public Task<ListPatientProfessionsResponse> GetPatientProfessions(Guid cabinetIdentityId, int pageNumber, int pageSize, string? searchQuery);
    public Task<ListPatientResponse> GetRecentPatientsForCabinet(Guid cabinetIdentityId, int pageNumber, int pageSize);
    public Task<ListPatientConsultationsResponse> GetPatientConsultations(Guid patientId, Guid cabinetIdentityId, int pageNumber, int pageSize);
    public Task<List<DailyConsultationResponse>> GetConsultationsByDate(Guid cabinetIdentityId, DateTime date);
    public Task<List<string>> GetConsultationDates(Guid cabinetIdentityId, int year, int month);
    public Task<NextPatientDossierNumberResponse> GetNextPatientDossierNumber(Guid cabinetIdentityId);
    public Task<VerifyPatientDossierNumberResponse> VerifyPatientDossierNumber(Guid cabinetIdentityId, int dossierNumber);
    public Task<byte[]> ExportPatientsCsv(Guid cabinetIdentityId, string? searchQuery, string? dateOfBirth, int? dossierNumber = null, string? phoneNumber = null, string? name = null, string? email = null, string? firstname = null, string? lastname = null, int? age = null);


}
