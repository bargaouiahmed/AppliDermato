using api.Src.ConsultationSpace.InterrogationSection.Dtos.Responses;
using api.Src.SelfCheckin.Dtos;

namespace api.Src.SelfCheckin.Services;

public interface ISelfCheckinService
{
    Task<SelfCheckinDoctorContext> ValidateDoctorContext(Guid doctorId, string kioskKey);
    Task<SelfCheckinBootstrapResponse> GetBootstrap(SelfCheckinDoctorContext doctorContext);
    Task<int> GetNextDossierNumber(SelfCheckinDoctorContext doctorContext);
    Task<IReadOnlyList<SelfCheckinPatientSummary>> FindPatients(
        SelfCheckinDoctorContext doctorContext,
        SelfCheckinFindPatientRequest request);
    Task<SelfCheckinPatientSummary> CreatePatient(
        SelfCheckinDoctorContext doctorContext,
        SelfCheckinCreatePatientRequest request);
    Task<SelfCheckinCreateConsultationResponse> CreateOrReuseConsultation(
        SelfCheckinDoctorContext doctorContext,
        SelfCheckinCreateConsultationRequest request);
    Task<IReadOnlyList<string>> PatchMotifs(
        SelfCheckinDoctorContext doctorContext,
        Guid consultationId,
        SelfCheckinPatchMotifRequest request);
    Task<ConsultationInterrogatoireResponse> PatchInterrogatoire(
        SelfCheckinDoctorContext doctorContext,
        Guid consultationId,
        SelfCheckinPatchInterrogatoireRequest request);
}

