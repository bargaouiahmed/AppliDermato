using api.Src.ConsultationSpace.ConduiteSection.Dtos.Requests;
using api.Src.ConsultationSpace.ConduiteSection.Dtos.Responses;

namespace api.Src.ConsultationSpace.ConduiteSection.Services;

public interface IConsultationLettreConfrereAiService
{
    Task<LettreConfrereAiJobResponse> EnqueueGenerateAsync(
        Guid consultationId,
        Guid cabinetIdentityId,
        GenerateLettreConfrereAiRequest request);

    Task<LettreConfrereAiJobResponse> EnqueueCorrectAsync(
        Guid consultationId,
        Guid cabinetIdentityId,
        CorrectLettreConfrereAiRequest request);

    Task<LettreConfrereAiJobResponse> GetJobAsync(
        Guid consultationId,
        Guid cabinetIdentityId,
        Guid jobId);

    Task ProcessJobAsync(Guid jobId, CancellationToken cancellationToken = default);
}
