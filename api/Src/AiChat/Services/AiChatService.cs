using System.ClientModel;
using System.Diagnostics;
using System.Globalization;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using api;
using api.Src.Configuration;
using api.Src.AiChat.Dtos;
using api.Src.AiChat.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using OpenAI;
using OpenAI.Chat;

namespace api.Src.AiChat.Services;

public sealed class AiChatException(string message, Exception? innerException = null)
    : Exception(message, innerException);

public sealed class AiChatService(
    AppDbContext dbContext,
    ILogger<AiChatService> logger,
    IConfiguration configuration) : IAiChatService
{
    private sealed record CalendarLeaveToolResult(
        Guid Id,
        string Date,
        bool IsFullDay,
        string? StartTime,
        string? EndTime,
        string Type,
        string Name,
        string? Description,
        bool IsRecurring);

    private const int MaxConversationMessages = 24;
    private const int MaxToolRounds = 8;
    private const int MaxOutputTokens = 1400;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private static readonly string SystemPrompt = string.Join("\n", [
        "Tu es l'assistant IA de Dermato.",
        "Tu aides des dermatologues dans leur raisonnement clinique, leur organisation et leur rédaction medicale.",
        "Réponds toujours dans la langue du dernier message de l'utilisateur. Si le message mélange plusieurs langues, utilise la langue dominante. Si l'utilisateur demande explicitement une autre langue, respecte cette demande.",
        "Sois pratique, structuré, prudent et concis. Signale les incertitudes et propose les points à vérifier.",
        "Utilise les outils disponibles lorsque la question concerne les patients, l'historique, les consultations, le calendrier, l'agenda, les rendez-vous, les statistiques ou les tendances du cabinet.",
        "Tu peux faire plusieurs appels d'outils en chaîne avant de répondre. Pour une question large, commence par les statistiques ou les tendances, puis appelle les détails/timelines des patients pertinents si cela aide.",
        "Quand le médecin demande les patients récurrents, fréquents, inhabituels, ou des patterns du cabinet, utilise les outils d'analyse du cabinet au lieu de répondre que tu ne peux pas.",
        "Quand les données sont volumineuses, résume les tendances principales et précise que l'analyse est limitée à l'échantillon/période retourné par les outils.",
        "Pour le format: préfère des titres courts, des listes à puces et des lignes 'label: valeur'. Évite les grands tableaux Markdown dans le chat sauf si le médecin demande explicitement un tableau.",
        "Quand tu cites plusieurs patients, utilise une liste numerotee avec 2-4 lignes par patient plutot qu'un tableau large.",
        "Le contexte fourni par l'application peut contenir patientId et consultationId de la consultation active. Quand le medecin dit ce patient, cette consultation, son dossier, ou pose une question sur le patient courant, utilise ce patientId avec les outils patients. Si seul consultationId est disponible, utilise l'outil de consultation pour retrouver le patient.",
        "Les outils sont strictement en lecture seule. Ne propose aucune action d'ecriture et ne cree jamais d'ordonnance, de conduite, de certificat ou de document.",
        "Ne mentionne jamais les noms des outils, les IDs techniques, JSON, ou les details d'implementation au medecin.",
        "Ne remplace jamais le jugement du medecin, l'examen clinique, les protocoles locaux ou l'avis urgent d'un specialiste.",
        "Tu n'as pas d'acces au web ni aux donnees patient en dehors de cette conversation, du contexte fourni par l'application et des outils en lecture seule.",
        "N'invente pas de resultats, de posologies ou de recommandations locales. Si l'information manque, demande les elements utiles."
    ]);

    public async Task<IReadOnlyList<AiChatSessionResponse>> GetSessionsAsync(
        Guid cabinetIdentityId,
        CancellationToken cancellationToken)
    {
        var sessions = await dbContext.AiChatSessions
            .AsNoTracking()
            .Include(s => s.Messages.Where(m => m.DeletedAt == null).OrderBy(m => m.SortOrder))
            .Where(s => s.CabinetIdentityId == cabinetIdentityId && s.DeletedAt == null)
            .OrderByDescending(s => s.UpdatedAt)
            .Take(50)
            .ToListAsync(cancellationToken);

        return sessions.Select(MapSession).ToList();
    }

    public async Task<AiChatSessionResponse> CreateSessionAsync(
        Guid cabinetIdentityId,
        CreateAiChatSessionRequest request,
        CancellationToken cancellationToken)
    {
        var session = new AiChatSession
        {
            Id = Guid.NewGuid(),
            CabinetIdentityId = cabinetIdentityId,
            Title = NormalizeTitle(request.Title) ?? "Nouvelle discussion",
            Context = request.Context?.Trim() ?? string.Empty
        };

        dbContext.AiChatSessions.Add(session);
        await dbContext.SaveChangesAsync(cancellationToken);

        return MapSession(session);
    }

    public async Task<AiChatSessionResponse> GetSessionAsync(
        Guid cabinetIdentityId,
        Guid sessionId,
        CancellationToken cancellationToken)
    {
        var session = await GetSessionEntityNoTrackingAsync(cabinetIdentityId, sessionId, cancellationToken);
        return MapSession(session);
    }

    public async Task DeleteSessionAsync(
        Guid cabinetIdentityId,
        Guid sessionId,
        CancellationToken cancellationToken)
    {
        var session = await dbContext.AiChatSessions
            .FirstOrDefaultAsync(s =>
                s.Id == sessionId &&
                s.CabinetIdentityId == cabinetIdentityId &&
                s.DeletedAt == null,
                cancellationToken);

        if (session is null)
        {
            throw new AiChatException("Discussion introuvable.");
        }

        session.DeletedAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task DeleteMessageAsync(
        Guid cabinetIdentityId,
        Guid sessionId,
        Guid messageId,
        CancellationToken cancellationToken)
    {
        var message = await dbContext.AiChatMessages
            .Include(m => m.Session)
            .FirstOrDefaultAsync(m =>
                m.Id == messageId &&
                m.AiChatSessionId == sessionId &&
                m.Session != null &&
                m.Session.CabinetIdentityId == cabinetIdentityId &&
                m.Session.DeletedAt == null &&
                m.DeletedAt == null,
                cancellationToken);

        if (message is null)
        {
            throw new AiChatException("Message introuvable.");
        }

        message.DeletedAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task<AiChatSessionResponse> SendMessageAsync(
        Guid cabinetIdentityId,
        Guid sessionId,
        SendAiChatMessageRequest request,
        CancellationToken cancellationToken)
    {
        // Once a chat turn starts, let it finish and persist even if the browser refreshes.
        var processingToken = CancellationToken.None;
        var turnStopwatch = Stopwatch.StartNew();
        var content = request.Content?.Trim();
        if (string.IsNullOrWhiteSpace(content))
        {
            throw new AiChatException("Le message est vide.");
        }

        logger.LogInformation(
            "[AI_CHAT] turn_start session={SessionId} cabinet={CabinetId} contentLength={ContentLength} requestAborted={RequestAborted}",
            sessionId,
            cabinetIdentityId,
            content.Length,
            cancellationToken.IsCancellationRequested);

        var session = await dbContext.AiChatSessions
            .AsNoTracking()
            .Where(s =>
                s.Id == sessionId &&
                s.CabinetIdentityId == cabinetIdentityId &&
                s.DeletedAt == null)
            .Select(s => new { s.Id, s.Context, s.Title })
            .FirstOrDefaultAsync(processingToken);

        if (session is null)
        {
            logger.LogWarning(
                "[AI_CHAT] turn_session_not_found session={SessionId} cabinet={CabinetId}",
                sessionId,
                cabinetIdentityId);
            throw new AiChatException("Discussion introuvable.");
        }

        var nowForPendingCheck = DateTime.UtcNow;
        var stalePendingBefore = nowForPendingCheck.AddMinutes(-5);

        var staleRecovered = await dbContext.AiChatMessages
            .Where(m =>
                m.AiChatSessionId == sessionId &&
                m.DeletedAt == null &&
                m.Role == "assistant" &&
                m.Status == "sending" &&
                m.CreatedAt <= stalePendingBefore)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(m => m.Status, "error")
                .SetProperty(m => m.Error, "request_timeout")
                .SetProperty(
                    m => m.Content,
                    "La reponse precedente n'a pas abouti. Reessayez depuis ce message.")
                .SetProperty(m => m.UpdatedAt, nowForPendingCheck),
                processingToken);
        if (staleRecovered > 0)
        {
            logger.LogWarning(
                "[AI_CHAT] stale_pending_recovered session={SessionId} count={Count}",
                sessionId,
                staleRecovered);
        }

        var hasActivePendingMessage = await dbContext.AiChatMessages
            .AsNoTracking()
            .AnyAsync(m =>
                m.AiChatSessionId == sessionId &&
                m.DeletedAt == null &&
                m.Role == "assistant" &&
                m.Status == "sending",
                processingToken);

        if (hasActivePendingMessage)
        {
            logger.LogWarning(
                "[AI_CHAT] turn_rejected_pending_exists session={SessionId}",
                sessionId);
            throw new AiChatException("Une reponse de l'assistant est deja en cours. Attendez sa fin avant d'envoyer un autre message.");
        }

        var existingMessages = await dbContext.AiChatMessages
            .AsNoTracking()
            .Where(m => m.AiChatSessionId == sessionId && m.DeletedAt == null)
            .OrderBy(m => m.SortOrder)
            .Select(m => new AiChatMessageDto(m.Role, m.Content))
            .ToListAsync(processingToken);

        var nextSortOrder = await dbContext.AiChatMessages
            .AsNoTracking()
            .Where(m => m.AiChatSessionId == sessionId)
            .Select(m => (int?)m.SortOrder)
            .MaxAsync(processingToken) ?? -1;
        nextSortOrder += 1;

        var utcNow = DateTime.UtcNow;
        var userMessage = new AiChatMessage
        {
            Id = Guid.NewGuid(),
            AiChatSessionId = sessionId,
            Role = "user",
            Content = content,
            Status = "ready",
            SortOrder = nextSortOrder,
            CreatedAt = utcNow,
            UpdatedAt = utcNow
        };

        var assistantMessage = new AiChatMessage
        {
            Id = Guid.NewGuid(),
            AiChatSessionId = sessionId,
            Role = "assistant",
            Content = string.Empty,
            Status = "sending",
            SortOrder = nextSortOrder + 1,
            CreatedAt = utcNow,
            UpdatedAt = utcNow
        };
        dbContext.AiChatMessages.AddRange(userMessage, assistantMessage);
        await dbContext.SaveChangesAsync(processingToken);
        logger.LogInformation(
            "[AI_CHAT] messages_created session={SessionId} userMessage={UserMessageId} assistantMessage={AssistantMessageId} historyCount={HistoryCount} nextSortOrder={SortOrder}",
            sessionId,
            userMessage.Id,
            assistantMessage.Id,
            existingMessages.Count,
            nextSortOrder);

        var normalizedTitle = existingMessages.Count == 0 ? NormalizeTitle(content) : null;
        var requestContext = request.Context?.Trim();
        var effectiveContext = !string.IsNullOrWhiteSpace(requestContext)
            ? requestContext
            : session.Context;

        await TouchSessionAsync(sessionId, normalizedTitle, requestContext, processingToken);

        var completionRequest = new AiChatCompletionRequest(
            existingMessages
                .Where(m => !string.Equals(m.Role, "assistant", StringComparison.OrdinalIgnoreCase) ||
                            !string.IsNullOrWhiteSpace(m.Content))
                .Concat([new AiChatMessageDto("user", content)])
                .ToList(),
            effectiveContext);

        string assistantContent;
        string assistantStatus;
        string assistantError;

        try
        {
            logger.LogInformation(
                "[AI_CHAT] completion_start session={SessionId} assistantMessage={AssistantMessageId} contextLength={ContextLength} conversationMessages={ConversationMessages}",
                sessionId,
                assistantMessage.Id,
                effectiveContext?.Length ?? 0,
                completionRequest.Messages.Count);
            var completion = await CompleteWithToolsAsync(
                cabinetIdentityId,
                completionRequest,
                processingToken);
            assistantContent = completion.Content;
            assistantStatus = "ready";
            assistantError = string.Empty;
            logger.LogInformation(
                "[AI_CHAT] completion_success session={SessionId} assistantMessage={AssistantMessageId} elapsedMs={ElapsedMs} responseLength={ResponseLength} model={Model} finishReason={FinishReason}",
                sessionId,
                assistantMessage.Id,
                turnStopwatch.ElapsedMilliseconds,
                assistantContent.Length,
                completion.Model,
                completion.FinishReason);
        }
        catch (AiChatException ex)
        {
            assistantContent = ex.Message;
            assistantStatus = "error";
            assistantError = "request_failed";
            logger.LogWarning(
                ex,
                "[AI_CHAT] completion_failed session={SessionId} assistantMessage={AssistantMessageId} elapsedMs={ElapsedMs} error={Error}",
                sessionId,
                assistantMessage.Id,
                turnStopwatch.ElapsedMilliseconds,
                ex.Message);
        }

        var rowsUpdated = await dbContext.AiChatMessages
            .Where(m => m.Id == assistantMessage.Id && m.AiChatSessionId == sessionId)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(m => m.Content, assistantContent)
                .SetProperty(m => m.Status, assistantStatus)
                .SetProperty(m => m.Error, assistantError)
                .SetProperty(m => m.UpdatedAt, DateTime.UtcNow),
                processingToken);

        if (rowsUpdated == 0)
        {
            logger.LogError(
                "[AI_CHAT] assistant_update_failed session={SessionId} assistantMessage={AssistantMessageId}",
                sessionId,
                assistantMessage.Id);
            throw new AiChatException("La reponse IA n'a pas pu etre enregistree. Rechargez la discussion.");
        }

        logger.LogInformation(
            "[AI_CHAT] assistant_update_saved session={SessionId} assistantMessage={AssistantMessageId} status={Status} elapsedMs={ElapsedMs}",
            sessionId,
            assistantMessage.Id,
            assistantStatus,
            turnStopwatch.ElapsedMilliseconds);

        await TouchSessionAsync(sessionId, null, null, processingToken);
        dbContext.ChangeTracker.Clear();
        return await GetSessionAsync(cabinetIdentityId, sessionId, processingToken);
    }

    public async Task<AiChatCompletionResponse> CompleteAsync(
        AiChatCompletionRequest request,
        CancellationToken cancellationToken)
    {
        var apiKey = ReadRequiredEnv("openrouter_api_key");
        var model = ReadRequiredEnv("openrouter_ai_model");
        var endpoint = Environment.GetEnvironmentVariable("openrouter_base_url")?.Trim();
        endpoint = string.IsNullOrWhiteSpace(endpoint) ? "https://openrouter.ai/api/v1" : endpoint;
        var httpReferer = GetOpenRouterHttpReferer();

        var client = new ChatClient(
            model,
            new ApiKeyCredential(apiKey),
            new OpenAIClientOptions { Endpoint = new Uri(endpoint) });

        var messages = BuildMessages(request);
        if (messages.Count <= 1)
        {
            throw new AiChatException("Le message est vide.");
        }

        try
        {
            return await CompleteWithSdkAsync(client, messages, model, cancellationToken);
        }
        catch (AiChatException)
        {
            throw;
        }
        catch (Exception ex)
        {
            try
            {
                return await CompleteWithOpenRouterHttpAsync(
                    apiKey,
                    model,
                    endpoint,
                    request,
                    httpReferer,
                    cancellationToken);
            }
            catch (AiChatException fallbackException)
            {
                var fallbackModel = Environment.GetEnvironmentVariable("openrouter_fallback_ai_model")?.Trim();
                fallbackModel = string.IsNullOrWhiteSpace(fallbackModel)
                    ? "google/gemma-3-27b-it:free"
                    : fallbackModel;

                if (!string.Equals(fallbackModel, model, StringComparison.OrdinalIgnoreCase) &&
                    ShouldTryFallbackModel(fallbackException.Message))
                {
                    try
                    {
                        return await CompleteWithOpenRouterHttpAsync(
                            apiKey,
                            fallbackModel,
                            endpoint,
                            request,
                            httpReferer,
                            cancellationToken);
                    }
                    catch (AiChatException secondFallbackException)
                    {
                        throw new AiChatException(
                            $"{secondFallbackException.Message} Le modele principal ({model}) a aussi echoue: {fallbackException.Message}",
                            secondFallbackException);
                    }
                }

                throw new AiChatException(
                    $"{fallbackException.Message} Detail SDK: {BuildFriendlyError(ex)}",
                    fallbackException);
            }
        }
    }

    private async Task<AiChatCompletionResponse> CompleteWithToolsAsync(
        Guid cabinetIdentityId,
        AiChatCompletionRequest request,
        CancellationToken cancellationToken)
    {
        var apiKey = ReadRequiredEnv("openrouter_api_key");
        var model = ReadRequiredEnv("openrouter_ai_model");
        var endpoint = Environment.GetEnvironmentVariable("openrouter_base_url")?.Trim();
        endpoint = string.IsNullOrWhiteSpace(endpoint) ? "https://openrouter.ai/api/v1" : endpoint;
        var httpReferer = GetOpenRouterHttpReferer();

        try
        {
            logger.LogInformation(
                "[AI_CHAT] model_try model={Model} endpoint={Endpoint} toolMode=true",
                model,
                endpoint);
            return await CompleteWithOpenRouterHttpToolsAsync(
                cabinetIdentityId,
                apiKey,
                model,
                endpoint,
                request,
                httpReferer,
                cancellationToken);
        }
        catch (AiChatException primaryException)
        {
            logger.LogWarning(
                primaryException,
                "[AI_CHAT] model_failed model={Model} error={Error}",
                model,
                primaryException.Message);
            var fallbackModel = Environment.GetEnvironmentVariable("openrouter_fallback_ai_model")?.Trim();
            fallbackModel = string.IsNullOrWhiteSpace(fallbackModel)
                ? "google/gemma-3-27b-it:free"
                : fallbackModel;

            if (!string.Equals(fallbackModel, model, StringComparison.OrdinalIgnoreCase) &&
                ShouldTryFallbackModel(primaryException.Message))
            {
                try
                {
                    logger.LogInformation(
                        "[AI_CHAT] fallback_model_try primaryModel={PrimaryModel} fallbackModel={FallbackModel}",
                        model,
                        fallbackModel);
                    return await CompleteWithOpenRouterHttpToolsAsync(
                        cabinetIdentityId,
                        apiKey,
                        fallbackModel,
                        endpoint,
                        request,
                        httpReferer,
                        cancellationToken);
                }
                catch (AiChatException fallbackException)
                {
                    logger.LogWarning(
                        fallbackException,
                        "[AI_CHAT] fallback_model_failed primaryModel={PrimaryModel} fallbackModel={FallbackModel} error={Error}",
                        model,
                        fallbackModel,
                        fallbackException.Message);
                    throw new AiChatException(
                        $"{fallbackException.Message} Le modele principal ({model}) a aussi echoue: {primaryException.Message}",
                        fallbackException);
                }
            }

            throw;
        }
    }

    private static async Task<AiChatCompletionResponse> CompleteWithSdkAsync(
        ChatClient client,
        List<ChatMessage> messages,
        string model,
        CancellationToken cancellationToken)
    {
        var completion = await client.CompleteChatAsync(
            messages,
            new ChatCompletionOptions
            {
                MaxOutputTokenCount = MaxOutputTokens
            },
            cancellationToken);

        var content = string.Join(
            string.Empty,
            completion.Value.Content
                .Where(part => !string.IsNullOrWhiteSpace(part.Text))
                .Select(part => part.Text));

        if (string.IsNullOrWhiteSpace(content))
        {
            throw new AiChatException(
                "OpenRouter a repondu sans texte. Verifiez le modele configure ou reessayez.");
        }

        return new AiChatCompletionResponse(
            content.Trim(),
            model,
            completion.Value.FinishReason.ToString());
    }

    private static async Task<AiChatCompletionResponse> CompleteWithOpenRouterHttpAsync(
        string apiKey,
        string model,
        string endpoint,
        AiChatCompletionRequest request,
        string httpReferer,
        CancellationToken cancellationToken)
    {
        using var httpClient = new HttpClient
        {
            Timeout = TimeSpan.FromSeconds(75)
        };

        httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        httpClient.DefaultRequestHeaders.TryAddWithoutValidation("HTTP-Referer", httpReferer);
        httpClient.DefaultRequestHeaders.TryAddWithoutValidation("X-Title", "Dermato");

        var body = new
        {
            model,
            messages = BuildOpenRouterMessages(request),
            max_tokens = MaxOutputTokens,
            temperature = 0.3,
            stream = false
        };

        var url = $"{endpoint.TrimEnd('/')}/chat/completions";
        using var content = new StringContent(
            JsonSerializer.Serialize(body, JsonOptions),
            Encoding.UTF8,
            "application/json");

        HttpResponseMessage response;
        try
        {
            response = await httpClient.PostAsync(url, content, cancellationToken);
        }
        catch (TaskCanceledException ex) when (!cancellationToken.IsCancellationRequested)
        {
            throw new AiChatException("OpenRouter met trop de temps a repondre. Reessayez dans quelques instants.", ex);
        }

        using (response)
        {
        var payload = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            throw new AiChatException(BuildOpenRouterHttpError(response.StatusCode, payload));
        }

        using var document = JsonDocument.Parse(payload);
        var root = document.RootElement;

        if (root.TryGetProperty("error", out var error))
        {
            var message = error.TryGetProperty("message", out var errorMessage)
                ? errorMessage.GetString()
                : "Erreur OpenRouter inconnue.";
            throw new AiChatException(message ?? "Erreur OpenRouter inconnue.");
        }

        var assistantContent = root
            .GetProperty("choices")[0]
            .GetProperty("message")
            .GetProperty("content")
            .GetString();

        if (string.IsNullOrWhiteSpace(assistantContent))
        {
            throw new AiChatException("OpenRouter a repondu sans texte. Reessayez ou changez de modele.");
        }

        var finishReason = root
            .GetProperty("choices")[0]
            .TryGetProperty("finish_reason", out var finishReasonElement)
            ? finishReasonElement.GetString() ?? "unknown"
            : "unknown";

        return new AiChatCompletionResponse(assistantContent.Trim(), model, finishReason);
        }
    }

    private async Task<AiChatCompletionResponse> CompleteWithOpenRouterHttpToolsAsync(
        Guid cabinetIdentityId,
        string apiKey,
        string model,
        string endpoint,
        AiChatCompletionRequest request,
        string httpReferer,
        CancellationToken cancellationToken)
    {
        using var httpClient = new HttpClient
        {
            Timeout = TimeSpan.FromSeconds(75)
        };

        httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        httpClient.DefaultRequestHeaders.TryAddWithoutValidation("HTTP-Referer", httpReferer);
        httpClient.DefaultRequestHeaders.TryAddWithoutValidation("X-Title", "Dermato");

        var messages = BuildOpenRouterToolMessages(request);
        var tools = BuildReadOnlyTools();
        var url = $"{endpoint.TrimEnd('/')}/chat/completions";

        for (var round = 0; round < MaxToolRounds; round++)
        {
            var roundStopwatch = Stopwatch.StartNew();
            var body = new
            {
                model,
                messages,
                tools,
                tool_choice = "auto",
                max_tokens = MaxOutputTokens,
                temperature = 0.3,
                stream = false
            };

            using var content = new StringContent(
                JsonSerializer.Serialize(body, JsonOptions),
                Encoding.UTF8,
                "application/json");

            HttpResponseMessage response;
            try
            {
                logger.LogInformation(
                    "[AI_CHAT] openrouter_request model={Model} round={Round} messages={MessageCount} tools={ToolCount}",
                    model,
                    round + 1,
                    messages.Count,
                    tools.Length);
                response = await httpClient.PostAsync(url, content, cancellationToken);
            }
            catch (TaskCanceledException ex) when (!cancellationToken.IsCancellationRequested)
            {
                logger.LogWarning(
                    ex,
                    "[AI_CHAT] openrouter_timeout model={Model} round={Round} elapsedMs={ElapsedMs}",
                    model,
                    round + 1,
                    roundStopwatch.ElapsedMilliseconds);
                throw new AiChatException("OpenRouter met trop de temps a repondre. Reessayez dans quelques instants.", ex);
            }

            using (response)
            {
            var payload = await response.Content.ReadAsStringAsync(cancellationToken);
            var statusCode = (int)response.StatusCode;
            logger.LogInformation(
                "[AI_CHAT] openrouter_response model={Model} round={Round} status={StatusCode} elapsedMs={ElapsedMs} payloadLength={PayloadLength}",
                model,
                round + 1,
                statusCode,
                roundStopwatch.ElapsedMilliseconds,
                payload.Length);

            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning(
                    "[AI_CHAT] openrouter_http_error model={Model} round={Round} status={StatusCode} payloadPreview={PayloadPreview}",
                    model,
                    round + 1,
                    statusCode,
                    TruncateForLog(payload, 500));
                throw new AiChatException(BuildOpenRouterHttpError(response.StatusCode, payload));
            }

            using var document = JsonDocument.Parse(payload);
            var root = document.RootElement;

            if (root.TryGetProperty("error", out var error))
            {
                var message = TryGetOpenRouterRawError(error);
                if (string.IsNullOrWhiteSpace(message) &&
                    error.TryGetProperty("message", out var errorMessage))
                {
                    message = errorMessage.GetString();
                }

                logger.LogWarning(
                    "[AI_CHAT] openrouter_payload_error model={Model} round={Round} error={Error}",
                    model,
                    round + 1,
                    message);
                throw new AiChatException(message ?? "Erreur OpenRouter inconnue.");
            }

            var choice = root.GetProperty("choices")[0];
            var messageElement = choice.GetProperty("message");

            if (messageElement.TryGetProperty("tool_calls", out var toolCalls) &&
                toolCalls.ValueKind == JsonValueKind.Array &&
                toolCalls.GetArrayLength() > 0)
            {
                logger.LogInformation(
                    "[AI_CHAT] tool_calls_requested model={Model} round={Round} count={Count}",
                    model,
                    round + 1,
                    toolCalls.GetArrayLength());
                messages.Add(JsonSerializer.Deserialize<Dictionary<string, object?>>(
                    messageElement.GetRawText(),
                    JsonOptions) ?? []);

                foreach (var toolCall in toolCalls.EnumerateArray())
                {
                    var toolCallId = toolCall.GetProperty("id").GetString() ?? string.Empty;
                    var function = toolCall.GetProperty("function");
                    var toolName = function.GetProperty("name").GetString() ?? string.Empty;
                    var rawArgs = function.TryGetProperty("arguments", out var argumentsElement)
                        ? argumentsElement.GetString() ?? "{}"
                        : "{}";

                    var toolStopwatch = Stopwatch.StartNew();
                    logger.LogInformation(
                        "[AI_CHAT] tool_start name={ToolName} round={Round} args={Args}",
                        toolName,
                        round + 1,
                        TruncateForLog(rawArgs, 500));
                    var toolResult = await ExecuteReadOnlyToolAsync(
                        cabinetIdentityId,
                        toolName,
                        rawArgs,
                        cancellationToken);
                    var serializedToolResult = JsonSerializer.Serialize(toolResult, JsonOptions);
                    logger.LogInformation(
                        "[AI_CHAT] tool_finish name={ToolName} round={Round} elapsedMs={ElapsedMs} resultLength={ResultLength}",
                        toolName,
                        round + 1,
                        toolStopwatch.ElapsedMilliseconds,
                        serializedToolResult.Length);

                    messages.Add(new Dictionary<string, object?>
                    {
                        ["role"] = "tool",
                        ["tool_call_id"] = toolCallId,
                        ["content"] = serializedToolResult
                    });
                }

                continue;
            }

            var assistantContent = messageElement.TryGetProperty("content", out var contentElement)
                ? contentElement.GetString()
                : null;

            if (string.IsNullOrWhiteSpace(assistantContent))
            {
                logger.LogWarning(
                    "[AI_CHAT] openrouter_empty_content model={Model} round={Round} finishReason={FinishReason}",
                    model,
                    round + 1,
                    choice.TryGetProperty("finish_reason", out var emptyFinishReasonElement)
                        ? emptyFinishReasonElement.GetString()
                        : null);
                throw new AiChatException("OpenRouter a repondu sans texte. Reessayez ou changez de modele.");
            }

            var finishReason = choice.TryGetProperty("finish_reason", out var finishReasonElement)
                ? finishReasonElement.GetString() ?? "unknown"
                : "unknown";

            logger.LogInformation(
                "[AI_CHAT] openrouter_assistant_content model={Model} round={Round} elapsedMs={ElapsedMs} responseLength={ResponseLength} finishReason={FinishReason}",
                model,
                round + 1,
                roundStopwatch.ElapsedMilliseconds,
                assistantContent.Length,
                finishReason);
            return new AiChatCompletionResponse(assistantContent.Trim(), model, finishReason);
            }
        }

        logger.LogWarning("[AI_CHAT] tool_round_limit_reached");
        throw new AiChatException("L'assistant a consulte trop de donnees sans produire de reponse. Reformulez la question.");
    }

    private static List<ChatMessage> BuildMessages(AiChatCompletionRequest request)
    {
        var messages = new List<ChatMessage> { new SystemChatMessage(SystemPrompt) };

        if (!string.IsNullOrWhiteSpace(request.Context))
        {
            messages.Add(new SystemChatMessage($"Contexte fourni par l'application: {request.Context.Trim()}"));
        }

        var conversation = (request.Messages ?? [])
            .Where(message => !string.IsNullOrWhiteSpace(message.Content))
            .TakeLast(MaxConversationMessages);

        foreach (var message in conversation)
        {
            var content = message.Content.Trim();
            switch (message.Role.Trim().ToLowerInvariant())
            {
                case "assistant":
                    messages.Add(new AssistantChatMessage(content));
                    break;
                case "user":
                    messages.Add(new UserChatMessage(content));
                    break;
            }
        }

        return messages;
    }

    private static List<object> BuildOpenRouterMessages(AiChatCompletionRequest request)
    {
        var messages = new List<object>
        {
            new { role = "system", content = SystemPrompt }
        };

        if (!string.IsNullOrWhiteSpace(request.Context))
        {
            messages.Add(new
            {
                role = "system",
                content = $"Contexte fourni par l'application: {request.Context.Trim()}"
            });
        }

        messages.AddRange((request.Messages ?? [])
            .Where(message => !string.IsNullOrWhiteSpace(message.Content))
            .TakeLast(MaxConversationMessages)
            .Where(message =>
                string.Equals(message.Role, "user", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(message.Role, "assistant", StringComparison.OrdinalIgnoreCase))
            .Select(message => new
            {
                role = message.Role.Trim().ToLowerInvariant(),
                content = message.Content.Trim()
            }));

        return messages;
    }

    private static List<Dictionary<string, object?>> BuildOpenRouterToolMessages(AiChatCompletionRequest request)
    {
        var messages = new List<Dictionary<string, object?>>
        {
            new()
            {
                ["role"] = "system",
                ["content"] = SystemPrompt
            }
        };

        if (!string.IsNullOrWhiteSpace(request.Context))
        {
            messages.Add(new Dictionary<string, object?>
            {
                ["role"] = "system",
                ["content"] = $"Contexte fourni par l'application: {request.Context.Trim()}"
            });
        }

        messages.AddRange((request.Messages ?? [])
            .Where(message => !string.IsNullOrWhiteSpace(message.Content))
            .TakeLast(MaxConversationMessages)
            .Where(message =>
                string.Equals(message.Role, "user", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(message.Role, "assistant", StringComparison.OrdinalIgnoreCase))
            .Select(message => new Dictionary<string, object?>
            {
                ["role"] = message.Role.Trim().ToLowerInvariant(),
                ["content"] = message.Content.Trim()
            }));

        return messages;
    }

    private static object[] BuildReadOnlyTools()
    {
        return
        [
            new
            {
                type = "function",
                function = new
                {
                    name = "get_frequent_patients",
                    description = "Find the most recurrent patients in the current cabinet for a period, with visit counts, recent consultation dates, motifs, diagnostics, and recurrence indicators. Read-only.",
                    parameters = new
                    {
                        type = "object",
                        properties = new
                        {
                            period = new { type = "string", description = "all_time, this_year, this_month, this_week, last_30_days, last_90_days, or custom." },
                            startDate = new { type = "string", description = "Optional custom start date in YYYY-MM-DD." },
                            endDate = new { type = "string", description = "Optional custom end date in YYYY-MM-DD, inclusive." },
                            limit = new { type = "integer", description = "Maximum patients, 1 to 30." }
                        }
                    }
                }
            },
            new
            {
                type = "function",
                function = new
                {
                    name = "analyze_cabinet_patterns",
                    description = "Analyze cabinet-level patterns across consultations: frequent diagnostics, motifs, recurring patients, age/sex/city groups, monthly activity, incomplete consultations, and patients with close repeat visits. Read-only.",
                    parameters = new
                    {
                        type = "object",
                        properties = new
                        {
                            period = new { type = "string", description = "all_time, this_year, this_month, this_week, last_30_days, last_90_days, or custom." },
                            startDate = new { type = "string", description = "Optional custom start date in YYYY-MM-DD." },
                            endDate = new { type = "string", description = "Optional custom end date in YYYY-MM-DD, inclusive." },
                            limit = new { type = "integer", description = "Maximum rows for top lists, 1 to 30." }
                        }
                    }
                }
            },
            new
            {
                type = "function",
                function = new
                {
                    name = "get_calendar_events",
                    description = "Fetch read-only calendar appointments, personnel appointments, blocked leave/holiday periods, and calendar settings for a date range in the current cabinet.",
                    parameters = new
                    {
                        type = "object",
                        properties = new
                        {
                            startDate = new { type = "string", description = "Start date in YYYY-MM-DD. Defaults to today." },
                            endDate = new { type = "string", description = "End date in YYYY-MM-DD, inclusive. Defaults to startDate. Maximum 62 days from startDate." },
                            includeLeaves = new { type = "boolean", description = "Include leaves and blocked periods. Defaults to true." },
                            limit = new { type = "integer", description = "Maximum appointments, 1 to 100." }
                        }
                    }
                }
            },
            new
            {
                type = "function",
                function = new
                {
                    name = "get_consultation_context",
                    description = "Fetch the current consultation summary and its patient identifier by consultation id in the current cabinet. Read-only.",
                    parameters = new
                    {
                        type = "object",
                        properties = new
                        {
                            consultationId = new { type = "string", description = "Consultation GUID." }
                        },
                        required = new[] { "consultationId" }
                    }
                }
            },
            new
            {
                type = "function",
                function = new
                {
                    name = "search_patients",
                    description = "Search patients in the current cabinet by name, dossier number, phone, email, city, or profession. Read-only.",
                    parameters = new
                    {
                        type = "object",
                        properties = new
                        {
                            query = new { type = "string", description = "Full or partial search text." },
                            limit = new { type = "integer", description = "Maximum rows, 1 to 10." }
                        },
                        required = new[] { "query" }
                    }
                }
            },
            new
            {
                type = "function",
                function = new
                {
                    name = "get_patient_details",
                    description = "Fetch demographics and compact consultation summary for one patient in the current cabinet. Read-only.",
                    parameters = new
                    {
                        type = "object",
                        properties = new
                        {
                            patientId = new { type = "string", description = "Patient GUID." }
                        },
                        required = new[] { "patientId" }
                    }
                }
            },
            new
            {
                type = "function",
                function = new
                {
                    name = "get_patient_timeline",
                    description = "Fetch recent consultation timeline for one patient including motifs, diagnostics, history, treatments, exam payload summary, and performed action types. Read-only.",
                    parameters = new
                    {
                        type = "object",
                        properties = new
                        {
                            patientId = new { type = "string", description = "Patient GUID." },
                            limit = new { type = "integer", description = "Maximum consultations, 1 to 20." }
                        },
                        required = new[] { "patientId" }
                    }
                }
            },
            new
            {
                type = "function",
                function = new
                {
                    name = "get_cabinet_statistics",
                    description = "Fetch cabinet-level patient and consultation statistics such as totals, sex distribution, age groups, diagnostic frequency, and monthly activity. Read-only.",
                    parameters = new
                    {
                        type = "object",
                        properties = new
                        {
                            period = new { type = "string", description = "all_time, this_year, this_month, or this_week." }
                        }
                    }
                }
            },
            new
            {
                type = "function",
                function = new
                {
                    name = "search_consultations",
                    description = "Search consultation motifs, diagnostics, and illness history by keyword across the current cabinet. Read-only.",
                    parameters = new
                    {
                        type = "object",
                        properties = new
                        {
                            query = new { type = "string", description = "Keyword or phrase to search." },
                            limit = new { type = "integer", description = "Maximum rows, 1 to 20." }
                        },
                        required = new[] { "query" }
                    }
                }
            }
        ];
    }

    private async Task<AiChatSession> GetSessionEntityNoTrackingAsync(
        Guid cabinetIdentityId,
        Guid sessionId,
        CancellationToken cancellationToken)
    {
        var session = await dbContext.AiChatSessions
            .AsNoTracking()
            .Include(s => s.Messages.Where(m => m.DeletedAt == null).OrderBy(m => m.SortOrder))
            .FirstOrDefaultAsync(s =>
                s.Id == sessionId &&
                s.CabinetIdentityId == cabinetIdentityId &&
                s.DeletedAt == null,
                cancellationToken);

        return session ?? throw new AiChatException("Discussion introuvable.");
    }

    private static AiChatSessionResponse MapSession(AiChatSession session)
    {
        return new AiChatSessionResponse(
            session.Id,
            session.Title,
            session.Context,
            session.CreatedAt,
            session.UpdatedAt,
            session.Messages
                .Where(m => m.DeletedAt == null)
                .OrderBy(m => m.SortOrder)
                .Select(MapMessage)
                .ToList());
    }

    private static AiChatMessageResponse MapMessage(AiChatMessage message)
    {
        return new AiChatMessageResponse(
            message.Id,
            message.Role,
            message.Content,
            message.Status,
            message.Error,
            message.CreatedAt,
            message.SortOrder);
    }

    private async Task<object> ExecuteReadOnlyToolAsync(
        Guid cabinetIdentityId,
        string toolName,
        string rawArguments,
        CancellationToken cancellationToken)
    {
        Dictionary<string, JsonElement> args;
        try
        {
            args = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(
                rawArguments,
                JsonOptions) ?? [];
        }
        catch
        {
            args = [];
        }

        return toolName switch
        {
            "search_patients" => await SearchPatientsToolAsync(cabinetIdentityId, args, cancellationToken),
            "get_frequent_patients" => await GetFrequentPatientsToolAsync(cabinetIdentityId, args, cancellationToken),
            "analyze_cabinet_patterns" => await AnalyzeCabinetPatternsToolAsync(cabinetIdentityId, args, cancellationToken),
            "get_calendar_events" => await GetCalendarEventsToolAsync(cabinetIdentityId, args, cancellationToken),
            "get_consultation_context" => await GetConsultationContextToolAsync(cabinetIdentityId, args, cancellationToken),
            "get_patient_details" => await GetPatientDetailsToolAsync(cabinetIdentityId, args, cancellationToken),
            "get_patient_timeline" => await GetPatientTimelineToolAsync(cabinetIdentityId, args, cancellationToken),
            "get_cabinet_statistics" => await GetCabinetStatisticsToolAsync(cabinetIdentityId, args, cancellationToken),
            "search_consultations" => await SearchConsultationsToolAsync(cabinetIdentityId, args, cancellationToken),
            _ => new { error = "Tool not found." }
        };
    }

    private async Task<object> GetConsultationContextToolAsync(
        Guid cabinetIdentityId,
        Dictionary<string, JsonElement> args,
        CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(ReadStringArg(args, "consultationId"), out var consultationId))
        {
            return new { error = "Invalid consultationId." };
        }

        var consultation = await dbContext.Consultations
            .AsNoTracking()
            .Where(c => c.CabinetIdentityId == cabinetIdentityId && c.Id == consultationId)
            .Select(c => new
            {
                c.Id,
                c.PatientId,
                c.ConsultationDate,
                Duration = FormatDuration(c.DurationSeconds),
                c.IsDone,
                Patient = new
                {
                    c.Patient.Id,
                    c.Patient.DossierNumber,
                    c.Patient.Firstname,
                    c.Patient.Lastname,
                    c.Patient.Sex,
                    Age = CalculateAge(c.Patient.DateOfBirth, DateTime.UtcNow.Date)
                },
                Motifs = c.Motifs.OrderBy(m => m.CreatedAt).Select(m => m.Value).ToList(),
                HistoireMaladie = c.Interrogatoire.HistoireMaladie,
                Diagnostics = c.Interrogatoire.Diagnostics
            })
            .FirstOrDefaultAsync(cancellationToken);

        return consultation is null ? new { error = "Consultation not found." } : consultation;
    }

    private async Task<object> GetCalendarEventsToolAsync(
        Guid cabinetIdentityId,
        Dictionary<string, JsonElement> args,
        CancellationToken cancellationToken)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow.Date);
        var startDate = ReadDateArg(args, "startDate") ?? today;
        var endDate = ReadDateArg(args, "endDate") ?? startDate;
        if (endDate < startDate)
        {
            (startDate, endDate) = (endDate, startDate);
        }

        var maxEndDate = startDate.AddDays(61);
        if (endDate > maxEndDate)
        {
            endDate = maxEndDate;
        }

        var includeLeaves = ReadBoolArg(args, "includeLeaves", true);
        var limit = ReadLimitArg(args, "limit", 50, 1, 100);
        var start = startDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        var end = endDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

        var settings = await dbContext.CalendarSettings
            .AsNoTracking()
            .Where(s => s.CabinetIdentityId == cabinetIdentityId)
            .Select(s => new
            {
                s.StartHour,
                s.EndHour,
                s.TimeSlotInterval
            })
            .FirstOrDefaultAsync(cancellationToken)
            ?? new { StartHour = 8, EndHour = 17, TimeSlotInterval = 15 };

        var appointments = await dbContext.Rdvs
            .AsNoTracking()
            .Where(r =>
                r.CabinetIdentityId == cabinetIdentityId &&
                string.Compare(r.Date, start) >= 0 &&
                string.Compare(r.Date, end) <= 0)
            .OrderBy(r => r.Date)
            .ThenBy(r => r.Time)
            .Take(limit)
            .Select(r => new
            {
                r.Id,
                r.Date,
                r.Time,
                r.Duration,
                Status = r.Status.ToString(),
                r.IsPersonnel,
                r.PersonnelDescription,
                r.PersonnelDuration,
                Motifs = r.Motifs == null ? Array.Empty<string>() : r.Motifs,
                Patient = r.Patient == null
                    ? null
                    : new
                    {
                        r.Patient.Id,
                        r.Patient.DossierNumber,
                        r.Patient.Firstname,
                        r.Patient.Lastname,
                        r.Patient.PhoneNumber
                    }
            })
            .ToListAsync(cancellationToken);

        var leaves = includeLeaves
            ? await GetCalendarLeavesAsync(cabinetIdentityId, startDate, endDate, cancellationToken)
            : [];

        var workloadByDate = appointments
            .GroupBy(a => a.Date)
            .OrderBy(g => g.Key)
            .Select(g => new
            {
                Date = g.Key,
                Total = g.Count(),
                Confirmed = g.Count(a => a.Status == "Confirme"),
                Pending = g.Count(a => a.Status == "EnAttenteDeValidation"),
                Cancelled = g.Count(a => a.Status == "Annule"),
                Personnel = g.Count(a => a.IsPersonnel),
                BookedMinutes = g.Sum(a => a.IsPersonnel ? (a.PersonnelDuration ?? a.Duration) : a.Duration)
            })
            .ToList();

        return new
        {
            range = new { startDate = start, endDate = end },
            settings,
            appointmentCount = appointments.Count,
            appointments,
            leaves,
            workloadByDate
        };
    }

    private async Task<object> GetFrequentPatientsToolAsync(
        Guid cabinetIdentityId,
        Dictionary<string, JsonElement> args,
        CancellationToken cancellationToken)
    {
        var limit = ReadLimitArg(args, "limit", 10, 1, 30);
        var (start, endExclusive, label) = ResolveToolDateRange(args);

        var consultationsQuery = dbContext.Consultations
            .AsNoTracking()
            .Where(c => c.CabinetIdentityId == cabinetIdentityId);

        if (start.HasValue)
        {
            consultationsQuery = consultationsQuery.Where(c => c.ConsultationDate >= start.Value);
        }

        if (endExclusive.HasValue)
        {
            consultationsQuery = consultationsQuery.Where(c => c.ConsultationDate < endExclusive.Value);
        }

        var frequentPatients = await consultationsQuery
            .GroupBy(c => new
            {
                c.PatientId,
                c.Patient.DossierNumber,
                c.Patient.Firstname,
                c.Patient.Lastname,
                c.Patient.Sex,
                c.Patient.DateOfBirth,
                c.Patient.City,
                c.Patient.PhoneNumber,
                c.Patient.Profession
            })
            .Select(g => new
            {
                g.Key.PatientId,
                g.Key.DossierNumber,
                g.Key.Firstname,
                g.Key.Lastname,
                g.Key.Sex,
                Age = CalculateAge(g.Key.DateOfBirth, DateTime.UtcNow.Date),
                g.Key.City,
                g.Key.PhoneNumber,
                g.Key.Profession,
                ConsultationCount = g.Count(),
                CompletedCount = g.Count(c => c.IsDone),
                FirstConsultationDate = g.Min(c => c.ConsultationDate),
                LastConsultationDate = g.Max(c => c.ConsultationDate)
            })
            .OrderByDescending(p => p.ConsultationCount)
            .ThenByDescending(p => p.LastConsultationDate)
            .Take(limit)
            .ToListAsync(cancellationToken);

        var patientIds = frequentPatients.Select(p => p.PatientId).ToList();
        var recentConsultations = await consultationsQuery
            .Where(c => patientIds.Contains(c.PatientId))
            .OrderByDescending(c => c.ConsultationDate)
            .Select(c => new
            {
                c.PatientId,
                c.ConsultationDate,
                Motifs = c.Motifs.OrderBy(m => m.CreatedAt).Select(m => m.Value).ToList(),
                Diagnostics = c.Interrogatoire.Diagnostics,
                HistoireMaladie = c.Interrogatoire.HistoireMaladie,
                c.IsDone
            })
            .ToListAsync(cancellationToken);

        var enriched = frequentPatients.Select(patient =>
        {
            var consultations = recentConsultations
                .Where(c => c.PatientId == patient.PatientId)
                .OrderByDescending(c => c.ConsultationDate)
                .ToList();
            var dates = consultations.Select(c => c.ConsultationDate.Date).OrderBy(d => d).ToList();

            return new
            {
                patient.PatientId,
                patient.DossierNumber,
                patient.Firstname,
                patient.Lastname,
                patient.Sex,
                patient.Age,
                patient.City,
                patient.PhoneNumber,
                patient.Profession,
                patient.ConsultationCount,
                patient.CompletedCount,
                OpenCount = patient.ConsultationCount - patient.CompletedCount,
                patient.FirstConsultationDate,
                patient.LastConsultationDate,
                AverageDaysBetweenVisits = CalculateAverageDaysBetweenDates(dates),
                CloseRepeatVisitCount = CountCloseRepeatVisits(dates, 30),
                RecentConsultations = consultations.Take(5).Select(c => new
                {
                    c.ConsultationDate,
                    c.Motifs,
                    c.Diagnostics,
                    c.IsDone
                }),
                TopMotifs = consultations
                    .SelectMany(c => c.Motifs)
                    .Where(v => !string.IsNullOrWhiteSpace(v))
                    .GroupBy(v => v.Trim(), StringComparer.OrdinalIgnoreCase)
                    .OrderByDescending(g => g.Count())
                    .ThenBy(g => g.Key)
                    .Take(5)
                    .Select(g => new { Label = g.Key, Count = g.Count() }),
                TopDiagnostics = consultations
                    .SelectMany(c => c.Diagnostics)
                    .Where(v => !string.IsNullOrWhiteSpace(v))
                    .GroupBy(v => v.Trim(), StringComparer.OrdinalIgnoreCase)
                    .OrderByDescending(g => g.Count())
                    .ThenBy(g => g.Key)
                    .Take(5)
                    .Select(g => new { Label = g.Key, Count = g.Count() })
            };
        }).ToList();

        return new
        {
            period = label,
            startDate = start?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            endDate = endExclusive?.AddDays(-1).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            count = enriched.Count,
            patients = enriched
        };
    }

    private async Task<object> AnalyzeCabinetPatternsToolAsync(
        Guid cabinetIdentityId,
        Dictionary<string, JsonElement> args,
        CancellationToken cancellationToken)
    {
        var limit = ReadLimitArg(args, "limit", 12, 1, 30);
        var (start, endExclusive, label) = ResolveToolDateRange(args);

        var consultationsQuery = dbContext.Consultations
            .AsNoTracking()
            .Where(c => c.CabinetIdentityId == cabinetIdentityId);

        if (start.HasValue)
        {
            consultationsQuery = consultationsQuery.Where(c => c.ConsultationDate >= start.Value);
        }

        if (endExclusive.HasValue)
        {
            consultationsQuery = consultationsQuery.Where(c => c.ConsultationDate < endExclusive.Value);
        }

        var consultations = await consultationsQuery
            .OrderByDescending(c => c.ConsultationDate)
            .Take(1500)
            .Select(c => new
            {
                c.Id,
                c.PatientId,
                c.ConsultationDate,
                c.IsDone,
                Motifs = c.Motifs.OrderBy(m => m.CreatedAt).Select(m => m.Value).ToList(),
                Diagnostics = c.Interrogatoire.Diagnostics,
                Patient = new
                {
                    c.Patient.DossierNumber,
                    c.Patient.Firstname,
                    c.Patient.Lastname,
                    c.Patient.Sex,
                    c.Patient.DateOfBirth,
                    c.Patient.City,
                    c.Patient.Profession
                }
            })
            .ToListAsync(cancellationToken);

        var patientGroups = consultations
            .GroupBy(c => c.PatientId)
            .Select(g =>
            {
                var orderedDates = g.Select(c => c.ConsultationDate.Date).OrderBy(d => d).ToList();
                var first = g.First().Patient;
                return new
                {
                    PatientId = g.Key,
                    first.DossierNumber,
                    first.Firstname,
                    first.Lastname,
                    first.Sex,
                    Age = CalculateAge(first.DateOfBirth, DateTime.UtcNow.Date),
                    first.City,
                    first.Profession,
                    ConsultationCount = g.Count(),
                    CloseRepeatVisitCount = CountCloseRepeatVisits(orderedDates, 30),
                    AverageDaysBetweenVisits = CalculateAverageDaysBetweenDates(orderedDates),
                    LastConsultationDate = g.Max(c => c.ConsultationDate)
                };
            })
            .OrderByDescending(p => p.ConsultationCount)
            .ThenByDescending(p => p.CloseRepeatVisitCount)
            .ThenByDescending(p => p.LastConsultationDate)
            .Take(limit)
            .ToList();

        return new
        {
            period = label,
            startDate = start?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            endDate = endExclusive?.AddDays(-1).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            sampleLimit = 1500,
            consultationCount = consultations.Count,
            patientCount = patientGroups.Count,
            completedConsultations = consultations.Count(c => c.IsDone),
            openConsultations = consultations.Count(c => !c.IsDone),
            topDiagnostics = BuildTopTextCounts(consultations.SelectMany(c => c.Diagnostics), limit),
            topMotifs = BuildTopTextCounts(consultations.SelectMany(c => c.Motifs), limit),
            frequentPatients = patientGroups,
            patientsWithCloseRepeatVisits = patientGroups
                .Where(p => p.CloseRepeatVisitCount > 0)
                .OrderByDescending(p => p.CloseRepeatVisitCount)
                .ThenByDescending(p => p.ConsultationCount)
                .Take(limit),
            sexDistribution = consultations
                .Select(c => c.Patient.Sex)
                .Where(v => !string.IsNullOrWhiteSpace(v))
                .GroupBy(v => v.Trim(), StringComparer.OrdinalIgnoreCase)
                .OrderByDescending(g => g.Count())
                .Select(g => new { Label = g.Key, Count = g.Count() }),
            ageGroups = BuildAgeGroups(consultations.Select(c => c.Patient.DateOfBirth), DateTime.UtcNow.Date),
            cityDistribution = BuildTopTextCounts(consultations.Select(c => c.Patient.City), limit),
            professionDistribution = BuildTopTextCounts(consultations.Select(c => c.Patient.Profession), limit),
            monthlyActivity = consultations
                .GroupBy(c => c.ConsultationDate.ToString("yyyy-MM", CultureInfo.InvariantCulture))
                .OrderBy(g => g.Key)
                .Select(g => new
                {
                    Month = g.Key,
                    Count = g.Count(),
                    Completed = g.Count(c => c.IsDone),
                    Open = g.Count(c => !c.IsDone)
                }),
            consultationsWithoutDiagnosis = consultations.Count(c => c.Diagnostics.Length == 0),
            consultationsWithoutMotif = consultations.Count(c => c.Motifs.Count == 0)
        };
    }

    private async Task<List<object>> GetCalendarLeavesAsync(
        Guid cabinetIdentityId,
        DateOnly startDate,
        DateOnly endDate,
        CancellationToken cancellationToken)
    {
        var start = startDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        var end = endDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        var leaves = await dbContext.Leaves
            .AsNoTracking()
            .Where(l =>
                l.CabinetIdentityId == cabinetIdentityId &&
                ((string.Compare(l.Date, start) >= 0 && string.Compare(l.Date, end) <= 0) ||
                 l.IsRecurring))
            .OrderBy(l => l.Date)
            .ThenBy(l => l.StartTime)
            .Select(l => new CalendarLeaveToolResult(
                l.Id,
                l.Date,
                l.IsFullDay,
                l.StartTime,
                l.EndTime,
                l.Type,
                l.Name,
                l.Description,
                l.IsRecurring))
            .ToListAsync(cancellationToken);

        return leaves
            .SelectMany(leave => ExpandCalendarLeave(leave, startDate, endDate))
            .OrderBy(leave => leave.Date)
            .Cast<object>()
            .ToList();
    }

    private static IEnumerable<CalendarLeaveToolResult> ExpandCalendarLeave(
        CalendarLeaveToolResult leave,
        DateOnly startDate,
        DateOnly endDate)
    {
        if (!leave.IsRecurring)
        {
            yield return leave;
            yield break;
        }

        if (!DateOnly.TryParseExact(leave.Date, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var sourceDate))
        {
            yield break;
        }

        for (var year = startDate.Year; year <= endDate.Year; year++)
        {
            var day = Math.Min(sourceDate.Day, DateTime.DaysInMonth(year, sourceDate.Month));
            var projectedDate = new DateOnly(year, sourceDate.Month, day);
            if (projectedDate < startDate || projectedDate > endDate)
            {
                continue;
            }

            yield return new CalendarLeaveToolResult(
                leave.Id,
                projectedDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                leave.IsFullDay,
                leave.StartTime,
                leave.EndTime,
                leave.Type,
                leave.Name,
                leave.Description,
                leave.IsRecurring);
        }
    }

    private async Task<object> SearchPatientsToolAsync(
        Guid cabinetIdentityId,
        Dictionary<string, JsonElement> args,
        CancellationToken cancellationToken)
    {
        var query = ReadStringArg(args, "query");
        var limit = ReadLimitArg(args, "limit", 8, 1, 10);
        if (string.IsNullOrWhiteSpace(query))
        {
            return new { error = "Missing query." };
        }

        var normalized = query.Trim();
        var search = $"%{normalized}%";
        var dossierNumber = int.TryParse(normalized, out var parsedDossierNumber)
            ? parsedDossierNumber
            : (int?)null;

        var patients = await dbContext.Patients
            .AsNoTracking()
            .Where(p => p.CabinetIdentityId == cabinetIdentityId)
            .Where(p =>
                EF.Functions.ILike(p.Firstname, search) ||
                EF.Functions.ILike(p.Lastname, search) ||
                EF.Functions.ILike(p.PhoneNumber, search) ||
                EF.Functions.ILike(p.Email, search) ||
                EF.Functions.ILike(p.City, search) ||
                EF.Functions.ILike(p.Profession, search) ||
                (dossierNumber.HasValue && p.DossierNumber == dossierNumber.Value))
            .OrderBy(p => p.Lastname)
            .ThenBy(p => p.Firstname)
            .Take(limit)
            .Select(p => new
            {
                p.Id,
                p.DossierNumber,
                p.Firstname,
                p.Lastname,
                p.Sex,
                Age = CalculateAge(p.DateOfBirth, DateTime.UtcNow.Date),
                p.PhoneNumber,
                p.City,
                p.Profession,
                ConsultationCount = p.Consultations.Count
            })
            .ToListAsync(cancellationToken);

        return new { query = normalized, count = patients.Count, patients };
    }

    private async Task<object> GetPatientDetailsToolAsync(
        Guid cabinetIdentityId,
        Dictionary<string, JsonElement> args,
        CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(ReadStringArg(args, "patientId"), out var patientId))
        {
            return new { error = "Invalid patientId." };
        }

        var patient = await dbContext.Patients
            .AsNoTracking()
            .Where(p => p.CabinetIdentityId == cabinetIdentityId && p.Id == patientId)
            .Select(p => new
            {
                p.Id,
                p.DossierNumber,
                p.Firstname,
                p.Lastname,
                p.DateOfBirth,
                Age = CalculateAge(p.DateOfBirth, DateTime.UtcNow.Date),
                p.Sex,
                p.PhoneNumber,
                p.Email,
                p.Country,
                p.City,
                p.Address,
                p.PostalCode,
                p.Profession,
                p.WorkPlace,
                p.FamilialStatus,
                p.APCI,
                p.InsuranceType,
                p.InsuranceEstablishment,
                ConsultationCount = p.Consultations.Count,
                LastConsultationDate = p.Consultations
                    .OrderByDescending(c => c.ConsultationDate)
                    .Select(c => (DateTime?)c.ConsultationDate)
                    .FirstOrDefault()
            })
            .FirstOrDefaultAsync(cancellationToken);

        return patient is null ? new { error = "Patient not found." } : patient;
    }

    private async Task<object> GetPatientTimelineToolAsync(
        Guid cabinetIdentityId,
        Dictionary<string, JsonElement> args,
        CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(ReadStringArg(args, "patientId"), out var patientId))
        {
            return new { error = "Invalid patientId." };
        }

        var limit = ReadLimitArg(args, "limit", 8, 1, 20);
        var patient = await dbContext.Patients
            .AsNoTracking()
            .Where(p => p.CabinetIdentityId == cabinetIdentityId && p.Id == patientId)
            .Select(p => new
            {
                p.Id,
                p.DossierNumber,
                p.Firstname,
                p.Lastname,
                p.Sex,
                Age = CalculateAge(p.DateOfBirth, DateTime.UtcNow.Date)
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (patient is null)
        {
            return new { error = "Patient not found." };
        }

        var consultations = await dbContext.Consultations
            .AsNoTracking()
            .Where(c =>
                c.CabinetIdentityId == cabinetIdentityId &&
                c.PatientId == patientId)
            .OrderByDescending(c => c.ConsultationDate)
            .ThenByDescending(c => c.CreatedAt)
            .Take(limit)
            .Select(c => new
            {
                c.Id,
                c.ConsultationDate,
                Duration = FormatDuration(c.DurationSeconds),
                c.IsDone,
                Motifs = c.Motifs.OrderBy(m => m.CreatedAt).Select(m => m.Value).ToList(),
                HistoireMaladie = c.Interrogatoire.HistoireMaladie,
                Diagnostics = c.Interrogatoire.Diagnostics,
                OngoingTreatments = c.Interrogatoire.OngoingTreatments
                    .OrderBy(t => t.CreatedAt)
                    .Select(t => new
                    {
                        t.Medicine,
                        t.TherapeuticClass,
                        t.Category,
                        t.Posology,
                        t.Duration,
                        t.Date
                    })
                    .ToList(),
                ExamAvailable = c.Exam != null,
                ConduiteActions = c.ConduiteActions
                    .OrderBy(a => a.SortOrder)
                    .Select(a => a.ActionKey)
                    .ToList()
            })
            .ToListAsync(cancellationToken);

        return new { patient, consultations };
    }

    private async Task<object> GetCabinetStatisticsToolAsync(
        Guid cabinetIdentityId,
        Dictionary<string, JsonElement> args,
        CancellationToken cancellationToken)
    {
        var period = ReadStringArg(args, "period").Trim().ToLowerInvariant();
        var (start, endExclusive) = ResolveToolPeriod(period);

        var patientsQuery = dbContext.Patients
            .AsNoTracking()
            .Where(p => p.CabinetIdentityId == cabinetIdentityId);

        var consultationsQuery = dbContext.Consultations
            .AsNoTracking()
            .Where(c => c.CabinetIdentityId == cabinetIdentityId);

        if (start.HasValue)
        {
            consultationsQuery = consultationsQuery.Where(c => c.ConsultationDate >= start.Value);
        }

        if (endExclusive.HasValue)
        {
            consultationsQuery = consultationsQuery.Where(c => c.ConsultationDate < endExclusive.Value);
        }

        var totalPatients = await patientsQuery.CountAsync(cancellationToken);
        var totalConsultations = await consultationsQuery.CountAsync(cancellationToken);
        var completedConsultations = await consultationsQuery.CountAsync(c => c.IsDone, cancellationToken);

        var sexDistribution = await patientsQuery
            .GroupBy(p => string.IsNullOrWhiteSpace(p.Sex) ? "Non renseigne" : p.Sex.Trim())
            .Select(g => new { label = g.Key, count = g.Count() })
            .OrderByDescending(x => x.count)
            .ToListAsync(cancellationToken);

        var birthDates = await patientsQuery
            .Select(p => p.DateOfBirth)
            .ToListAsync(cancellationToken);
        var ageGroups = BuildAgeGroups(birthDates, DateTime.UtcNow.Date);

        var diagnosticFrequency = await consultationsQuery
            .Where(c => c.Interrogatoire.Diagnostics.Length > 0)
            .SelectMany(c => c.Interrogatoire.Diagnostics)
            .Where(d => d != null && d.Trim() != string.Empty)
            .GroupBy(d => d.Trim())
            .Select(g => new { label = g.Key, count = g.Count() })
            .OrderByDescending(x => x.count)
            .Take(12)
            .ToListAsync(cancellationToken);

        var monthlyActivity = await consultationsQuery
            .GroupBy(c => new { c.ConsultationDate.Year, c.ConsultationDate.Month })
            .Select(g => new
            {
                month = $"{g.Key.Year}-{g.Key.Month:D2}",
                count = g.Count()
            })
            .OrderBy(x => x.month)
            .Take(24)
            .ToListAsync(cancellationToken);

        return new
        {
            period = string.IsNullOrWhiteSpace(period) ? "all_time" : period,
            totalPatients,
            totalConsultations,
            completedConsultations,
            openConsultations = totalConsultations - completedConsultations,
            sexDistribution,
            ageGroups,
            diagnosticFrequency,
            monthlyActivity
        };
    }

    private async Task<object> SearchConsultationsToolAsync(
        Guid cabinetIdentityId,
        Dictionary<string, JsonElement> args,
        CancellationToken cancellationToken)
    {
        var query = ReadStringArg(args, "query");
        var limit = ReadLimitArg(args, "limit", 10, 1, 20);
        if (string.IsNullOrWhiteSpace(query))
        {
            return new { error = "Missing query." };
        }

        var search = $"%{query.Trim()}%";
        var consultations = await dbContext.Consultations
            .AsNoTracking()
            .Where(c => c.CabinetIdentityId == cabinetIdentityId)
            .Where(c =>
                c.Motifs.Any(m => EF.Functions.ILike(m.Value, search)) ||
                EF.Functions.ILike(c.Interrogatoire.HistoireMaladie, search) ||
                c.Interrogatoire.Diagnostics.Any(d => EF.Functions.ILike(d, search)))
            .OrderByDescending(c => c.ConsultationDate)
            .Take(limit)
            .Select(c => new
            {
                c.Id,
                c.ConsultationDate,
                Patient = new
                {
                    c.Patient.Id,
                    c.Patient.DossierNumber,
                    c.Patient.Firstname,
                    c.Patient.Lastname,
                    c.Patient.Sex,
                    Age = CalculateAge(c.Patient.DateOfBirth, DateTime.UtcNow.Date)
                },
                Motifs = c.Motifs.Select(m => m.Value).ToList(),
                Diagnostics = c.Interrogatoire.Diagnostics,
                HistoireMaladie = c.Interrogatoire.HistoireMaladie,
                c.IsDone
            })
            .ToListAsync(cancellationToken);

        return new { query = query.Trim(), count = consultations.Count, consultations };
    }

    private async Task TouchSessionAsync(
        Guid sessionId,
        string? title,
        string? context,
        CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var hasTitle = !string.IsNullOrWhiteSpace(title);
        var hasContext = context is not null;

        var rowsUpdated = (hasTitle, hasContext) switch
        {
            (true, true) => await dbContext.AiChatSessions
                .Where(s => s.Id == sessionId && s.DeletedAt == null)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(s => s.Title, title)
                    .SetProperty(s => s.Context, context)
                    .SetProperty(s => s.UpdatedAt, now),
                    cancellationToken),
            (true, false) => await dbContext.AiChatSessions
                .Where(s => s.Id == sessionId && s.DeletedAt == null)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(s => s.Title, title)
                    .SetProperty(s => s.UpdatedAt, now),
                    cancellationToken),
            (false, true) => await dbContext.AiChatSessions
                .Where(s => s.Id == sessionId && s.DeletedAt == null)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(s => s.Context, context)
                    .SetProperty(s => s.UpdatedAt, now),
                    cancellationToken),
            _ => await dbContext.AiChatSessions
                .Where(s => s.Id == sessionId && s.DeletedAt == null)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(s => s.UpdatedAt, now),
                    cancellationToken)
        };

        if (rowsUpdated == 0)
        {
            throw new AiChatException("Discussion introuvable.");
        }
    }

    private static string? NormalizeTitle(string? value)
    {
        var title = value?.ReplaceLineEndings(" ").Trim();
        if (string.IsNullOrWhiteSpace(title))
        {
            return null;
        }

        return title.Length > 80 ? $"{title[..80]}..." : title;
    }

    private static string ReadStringArg(Dictionary<string, JsonElement> args, string key)
    {
        if (!args.TryGetValue(key, out var value))
        {
            return string.Empty;
        }

        return value.ValueKind == JsonValueKind.String
            ? value.GetString()?.Trim() ?? string.Empty
            : value.ToString().Trim();
    }

    private static int ReadLimitArg(
        Dictionary<string, JsonElement> args,
        string key,
        int fallback,
        int min,
        int max)
    {
        if (!args.TryGetValue(key, out var value))
        {
            return fallback;
        }

        var parsed = value.ValueKind switch
        {
            JsonValueKind.Number when value.TryGetInt32(out var number) => number,
            JsonValueKind.String when int.TryParse(value.GetString(), out var number) => number,
            _ => fallback
        };

        return Math.Clamp(parsed, min, max);
    }

    private static bool ReadBoolArg(
        Dictionary<string, JsonElement> args,
        string key,
        bool fallback)
    {
        if (!args.TryGetValue(key, out var value))
        {
            return fallback;
        }

        return value.ValueKind switch
        {
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.String when bool.TryParse(value.GetString(), out var parsed) => parsed,
            _ => fallback
        };
    }

    private static DateOnly? ReadDateArg(Dictionary<string, JsonElement> args, string key)
    {
        var value = ReadStringArg(args, key);
        return DateOnly.TryParseExact(
            value,
            "yyyy-MM-dd",
            CultureInfo.InvariantCulture,
            DateTimeStyles.None,
            out var parsed)
            ? parsed
            : null;
    }

    private static int CalculateAge(DateTime birthDate, DateTime onDate)
    {
        var age = onDate.Year - birthDate.Year;
        if (onDate.Date < birthDate.Date.AddYears(age))
        {
            age--;
        }

        return Math.Max(0, age);
    }

    private static string FormatDuration(int durationSeconds)
    {
        var duration = TimeSpan.FromSeconds(Math.Max(0, durationSeconds));
        return duration.ToString(@"hh\:mm\:ss");
    }

    private static string TruncateForLog(string? value, int maxLength)
    {
        if (string.IsNullOrEmpty(value))
        {
            return string.Empty;
        }

        var normalized = value.ReplaceLineEndings(" ");
        return normalized.Length <= maxLength
            ? normalized
            : $"{normalized[..maxLength]}...";
    }

    private static List<object> BuildTopTextCounts(IEnumerable<string?> values, int limit)
    {
        return values
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Select(value => value!.Trim())
            .GroupBy(value => value, StringComparer.OrdinalIgnoreCase)
            .OrderByDescending(group => group.Count())
            .ThenBy(group => group.Key)
            .Take(limit)
            .Select(group => new { Label = group.Key, Count = group.Count() })
            .Cast<object>()
            .ToList();
    }

    private static double? CalculateAverageDaysBetweenDates(IReadOnlyList<DateTime> orderedDates)
    {
        if (orderedDates.Count < 2)
        {
            return null;
        }

        var gaps = orderedDates
            .Zip(orderedDates.Skip(1), (previous, next) => (next - previous).TotalDays)
            .Where(days => days >= 0)
            .ToList();

        return gaps.Count == 0 ? null : Math.Round(gaps.Average(), 1);
    }

    private static int CountCloseRepeatVisits(IReadOnlyList<DateTime> orderedDates, int maxDays)
    {
        if (orderedDates.Count < 2)
        {
            return 0;
        }

        return orderedDates
            .Zip(orderedDates.Skip(1), (previous, next) => (next - previous).TotalDays)
            .Count(days => days > 0 && days <= maxDays);
    }

    private static (DateTime? Start, DateTime? EndExclusive, string Label) ResolveToolDateRange(
        Dictionary<string, JsonElement> args)
    {
        var period = ReadStringArg(args, "period").Trim().ToLowerInvariant();
        var customStart = ReadDateArg(args, "startDate");
        var customEnd = ReadDateArg(args, "endDate");
        if (customStart.HasValue || customEnd.HasValue)
        {
            var start = customStart ?? customEnd ?? DateOnly.FromDateTime(DateTime.UtcNow.Date);
            var end = customEnd ?? customStart ?? start;
            if (end < start)
            {
                (start, end) = (end, start);
            }

            return (
                start.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc),
                end.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc),
                "custom");
        }

        var today = DateTime.UtcNow.Date;
        return period switch
        {
            "this_week" => (StartOfWeek(today), StartOfWeek(today).AddDays(7), "this_week"),
            "this_month" => (
                new DateTime(today.Year, today.Month, 1, 0, 0, 0, DateTimeKind.Utc),
                new DateTime(today.Year, today.Month, 1, 0, 0, 0, DateTimeKind.Utc).AddMonths(1),
                "this_month"),
            "this_year" => (
                new DateTime(today.Year, 1, 1, 0, 0, 0, DateTimeKind.Utc),
                new DateTime(today.Year + 1, 1, 1, 0, 0, 0, DateTimeKind.Utc),
                "this_year"),
            "last_30_days" => (today.AddDays(-30), today.AddDays(1), "last_30_days"),
            "last_90_days" => (today.AddDays(-90), today.AddDays(1), "last_90_days"),
            _ => (null, null, "all_time")
        };
    }

    private static (DateTime? Start, DateTime? EndExclusive) ResolveToolPeriod(string period)
    {
        var today = DateTime.UtcNow.Date;
        return period switch
        {
            "this_week" => (StartOfWeek(today), StartOfWeek(today).AddDays(7)),
            "this_month" => (
                new DateTime(today.Year, today.Month, 1, 0, 0, 0, DateTimeKind.Utc),
                new DateTime(today.Year, today.Month, 1, 0, 0, 0, DateTimeKind.Utc).AddMonths(1)),
            "this_year" => (
                new DateTime(today.Year, 1, 1, 0, 0, 0, DateTimeKind.Utc),
                new DateTime(today.Year + 1, 1, 1, 0, 0, 0, DateTimeKind.Utc)),
            _ => (null, null)
        };
    }

    private static DateTime StartOfWeek(DateTime date)
    {
        var diff = ((int)date.DayOfWeek + 6) % 7;
        return date.Date.AddDays(-diff);
    }

    private static List<object> BuildAgeGroups(IEnumerable<DateTime> birthDates, DateTime today)
    {
        var buckets = new Dictionary<string, int>
        {
            ["0-12 ans"] = 0,
            ["13-17 ans"] = 0,
            ["18-39 ans"] = 0,
            ["40-64 ans"] = 0,
            ["65+ ans"] = 0
        };

        foreach (var birthDate in birthDates)
        {
            var age = CalculateAge(birthDate, today);
            var key = age switch
            {
                <= 12 => "0-12 ans",
                <= 17 => "13-17 ans",
                <= 39 => "18-39 ans",
                <= 64 => "40-64 ans",
                _ => "65+ ans"
            };
            buckets[key]++;
        }

        return buckets
            .Select(item => new { label = item.Key, count = item.Value })
            .Cast<object>()
            .ToList();
    }

    private static string ReadRequiredEnv(string name)
    {
        var value = Environment.GetEnvironmentVariable(name)?.Trim();
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new AiChatException($"Configuration manquante: {name}.");
        }

        return value;
    }

    private string GetOpenRouterHttpReferer()
    {
        var configuredReferer = PublicUrlSettingsReader.ReadSetting(
            configuration,
            "OpenRouter:HttpReferer",
            "openrouter_http_referer",
            string.Empty);

        return !string.IsNullOrWhiteSpace(configuredReferer)
            ? PublicUrlSettingsReader.NormalizeBaseUrl(configuredReferer)
            : PublicUrlSettingsReader.Read(configuration).FrontendUrl;
    }

    private static string BuildFriendlyError(Exception ex)
    {
        var message = ex.Message;

        if (message.Contains("401", StringComparison.OrdinalIgnoreCase) ||
            message.Contains("unauthorized", StringComparison.OrdinalIgnoreCase))
        {
            return "OpenRouter a refuse la cle API. Verifiez openrouter_api_key.";
        }

        if (message.Contains("404", StringComparison.OrdinalIgnoreCase) ||
            message.Contains("model", StringComparison.OrdinalIgnoreCase))
        {
            return "Le modele OpenRouter configure est introuvable ou indisponible. Verifiez openrouter_ai_model.";
        }

        if (message.Contains("timeout", StringComparison.OrdinalIgnoreCase) ||
            message.Contains("timed out", StringComparison.OrdinalIgnoreCase))
        {
            return "La reponse de l'assistant a pris trop de temps. Reessayez.";
        }

        return "Impossible d'obtenir une reponse de l'assistant IA pour le moment.";
    }

    private static string BuildOpenRouterHttpError(System.Net.HttpStatusCode statusCode, string payload)
    {
        try
        {
            using var document = JsonDocument.Parse(payload);
            if (document.RootElement.TryGetProperty("error", out var error) &&
                error.TryGetProperty("message", out var messageElement))
            {
                var message = TryGetOpenRouterRawError(error) ?? messageElement.GetString();
                if (!string.IsNullOrWhiteSpace(message))
                {
                    return $"OpenRouter a refuse la requete ({(int)statusCode}): {message}";
                }
            }
        }
        catch
        {
            // Use the generic message below if the provider response is not JSON.
        }

        return $"OpenRouter a refuse la requete ({(int)statusCode}).";
    }

    private static bool ShouldTryFallbackModel(string message)
    {
        return message.Contains("(429)", StringComparison.OrdinalIgnoreCase) ||
               message.Contains("(400)", StringComparison.OrdinalIgnoreCase) ||
               message.Contains("temporarily rate-limited", StringComparison.OrdinalIgnoreCase) ||
               message.Contains("Provider returned error", StringComparison.OrdinalIgnoreCase);
    }

    private static string? TryGetOpenRouterRawError(JsonElement error)
    {
        if (error.TryGetProperty("metadata", out var metadata) &&
            metadata.TryGetProperty("raw", out var rawElement))
        {
            return rawElement.GetString();
        }

        return null;
    }
}
