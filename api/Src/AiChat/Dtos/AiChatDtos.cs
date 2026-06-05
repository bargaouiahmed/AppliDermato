namespace api.Src.AiChat.Dtos;

public sealed record AiChatMessageDto(string Role, string Content);

public sealed record AiChatCompletionRequest(
    IReadOnlyList<AiChatMessageDto> Messages,
    string? Context = null);

public sealed record AiChatCompletionResponse(
    string Content,
    string Model,
    string FinishReason);

public sealed record AiChatErrorResponse(string Message);

public sealed record AiChatSessionResponse(
    Guid Id,
    string Title,
    string Context,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    IReadOnlyList<AiChatMessageResponse> Messages);

public sealed record AiChatMessageResponse(
    Guid Id,
    string Role,
    string Content,
    string Status,
    string Error,
    DateTime CreatedAt,
    int SortOrder);

public sealed record CreateAiChatSessionRequest(
    string? Title = null,
    string? Context = null);

public sealed record SendAiChatMessageRequest(
    string Content,
    string? Context = null);
