using api.Src.ConsultationSpace.ConduiteSection.Dtos.Responses;

namespace api.Src.ConsultationSpace.ConduiteSection.Services;

public interface IConduitePrintService
{
    Task<CnamPrintDataResponse> GetCnamPrintData(
        Guid consultationId,
        Guid cabinetIdentityId);

    Task<PrintableConduiteDocumentResponse> GeneratePrintableDocument(
        Guid consultationId,
        string documentType,
        Guid cabinetIdentityId,
        IReadOnlyCollection<string>? sections = null,
        string? language = null);

    Task<byte[]> GenerateParacliniquePdf(
        Guid consultationId,
        Guid cabinetIdentityId,
        IReadOnlyCollection<string>? sections = null,
        string? language = null);
}
