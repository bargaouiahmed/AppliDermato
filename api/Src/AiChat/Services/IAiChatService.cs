using api.Src.AiChat.Dtos;

namespace api.Src.AiChat.Services;

public interface IAiChatService
{
    Task<IReadOnlyList<AiChatSessionResponse>> GetSessionsAsync(
        Guid cabinetIdentityId,
        CancellationToken cancellationToken);

    Task<AiChatSessionResponse> CreateSessionAsync(
        Guid cabinetIdentityId,
        CreateAiChatSessionRequest request,
        CancellationToken cancellationToken);

    Task<AiChatSessionResponse> GetSessionAsync(
        Guid cabinetIdentityId,
        Guid sessionId,
        CancellationToken cancellationToken);

    Task DeleteSessionAsync(
        Guid cabinetIdentityId,
        Guid sessionId,
        CancellationToken cancellationToken);

    Task DeleteMessageAsync(
        Guid cabinetIdentityId,
        Guid sessionId,
        Guid messageId,
        CancellationToken cancellationToken);

    Task<AiChatSessionResponse> SendMessageAsync(
        Guid cabinetIdentityId,
        Guid sessionId,
        SendAiChatMessageRequest request,
        CancellationToken cancellationToken);

    Task<AiChatCompletionResponse> CompleteAsync(
        AiChatCompletionRequest request,
        CancellationToken cancellationToken);
}
