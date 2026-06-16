using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Globalization;
using api.Src.ConsultationSpace.ConduiteSection;
using api.Src.ConsultationSpace.ConduiteSection.CronJobs;
using api.Src.ConsultationSpace.ConduiteSection.Dtos.Requests;
using api.Src.ConsultationSpace.ConduiteSection.Dtos.Responses;
using api.Src.ConsultationSpace.ConduiteSection.Entities;
using api.Src.ConsultationSpace.ConduiteSection.Realtime;
using Microsoft.EntityFrameworkCore;
using Quartz;

namespace api.Src.ConsultationSpace.ConduiteSection.Services;

public sealed class ConsultationLettreConfrereAiService(
    AppDbContext db,
    ISchedulerFactory schedulerFactory,
    IConsultationAiNotifier notifier,
    ILogger<ConsultationLettreConfrereAiService> logger) : IConsultationLettreConfrereAiService
{
    private const int MaxLetterTokens = 900;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<LettreConfrereAiJobResponse> EnqueueGenerateAsync(
        Guid consultationId,
        Guid cabinetIdentityId,
        GenerateLettreConfrereAiRequest request)
    {
        var description = NormalizeText(request.GeneralDescription);
        if (string.IsNullOrWhiteSpace(description))
        {
            throw new InvalidOperationException("Merci de saisir une description gÃ©nÃ©rale pour la lettre IA.");
        }

        await EnsureConsultationOwnershipAsync(consultationId, cabinetIdentityId);

        var job = new ConsultationLettreConfrereAiJob
        {
            Id = Guid.NewGuid(),
            ConsultationId = consultationId,
            CabinetIdentityId = cabinetIdentityId,
            Operation = LettreConfrereAiJobOperations.Generate,
            Status = LettreConfrereAiJobStatuses.Queued,
            GeneralDescription = description,
            SourceContent = NormalizeText(request.Contenue),
            Medecin = Truncate(NormalizeText(request.Medecin), 180),
            Formulepolitesse = Truncate(NormalizeText(request.Formulepolitesse), 80),
        };

        db.ConsultationLettreConfrereAiJobs.Add(job);
        await db.SaveChangesAsync();
        await ScheduleJobAsync(job.Id);
        await NotifyJobSafelyAsync(job);

        return MapJob(job);
    }

    public async Task<LettreConfrereAiJobResponse> EnqueueCorrectAsync(
        Guid consultationId,
        Guid cabinetIdentityId,
        CorrectLettreConfrereAiRequest request)
    {
        var content = NormalizeText(request.Contenue);
        if (string.IsNullOrWhiteSpace(StripHtml(content)))
        {
            throw new InvalidOperationException("Aucun contenu Ã  corriger pour cette lettre.");
        }

        await EnsureConsultationOwnershipAsync(consultationId, cabinetIdentityId);

        var job = new ConsultationLettreConfrereAiJob
        {
            Id = Guid.NewGuid(),
            ConsultationId = consultationId,
            CabinetIdentityId = cabinetIdentityId,
            Operation = LettreConfrereAiJobOperations.Correct,
            Status = LettreConfrereAiJobStatuses.Queued,
            CorrectionPrompt = Truncate(NormalizeText(request.CorrectionPrompt), 500),
            SourceContent = content,
            Medecin = Truncate(NormalizeText(request.Medecin), 180),
            Formulepolitesse = Truncate(NormalizeText(request.Formulepolitesse), 80),
        };

        db.ConsultationLettreConfrereAiJobs.Add(job);
        await db.SaveChangesAsync();
        await ScheduleJobAsync(job.Id);
        await NotifyJobSafelyAsync(job);

        return MapJob(job);
    }

    public async Task<LettreConfrereAiJobResponse> GetJobAsync(
        Guid consultationId,
        Guid cabinetIdentityId,
        Guid jobId)
    {
        var job = await db.ConsultationLettreConfrereAiJobs
            .AsNoTracking()
            .FirstOrDefaultAsync(item =>
                item.Id == jobId &&
                item.ConsultationId == consultationId &&
                item.CabinetIdentityId == cabinetIdentityId);

        if (job is null)
        {
            throw new InvalidOperationException("AI letter job not found.");
        }

        return MapJob(job);
    }

    public async Task ProcessJobAsync(Guid jobId, CancellationToken cancellationToken = default)
    {
        var job = await db.ConsultationLettreConfrereAiJobs
            .FirstOrDefaultAsync(item => item.Id == jobId, cancellationToken);

        if (job is null)
        {
            logger.LogWarning("[LETTRE_AI] job_not_found job={JobId}", jobId);
            return;
        }

        if (job.Status is LettreConfrereAiJobStatuses.Completed or LettreConfrereAiJobStatuses.Processing)
        {
            return;
        }

        job.Status = LettreConfrereAiJobStatuses.Processing;
        job.StartedAtUtc = DateTime.UtcNow;
        job.Error = string.Empty;
        await db.SaveChangesAsync(cancellationToken);
        await NotifyJobSafelyAsync(job);

        try
        {
            var context = await BuildLetterContextAsync(job.ConsultationId, job.CabinetIdentityId, cancellationToken);
            var rawAiText = job.Operation == LettreConfrereAiJobOperations.Correct
                ? await CorrectLetterAsync(job, context, cancellationToken)
                : await GenerateLetterAsync(job, context, cancellationToken);

            var resultPayload = ExtractLettrePayload(
                rawAiText,
                job.Medecin,
                job.Formulepolitesse);

            await UpsertLettreActionAsync(job.ConsultationId, resultPayload, cancellationToken);

            job.ResultPayload = ClonePayload(resultPayload);
            job.Status = LettreConfrereAiJobStatuses.Completed;
            job.Error = string.Empty;
            job.CompletedAtUtc = DateTime.UtcNow;
            await db.SaveChangesAsync(cancellationToken);
            await NotifyJobSafelyAsync(job);

            logger.LogInformation(
                "[LETTRE_AI] job_completed job={JobId} consultation={ConsultationId} operation={Operation}",
                job.Id,
                job.ConsultationId,
                job.Operation);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[LETTRE_AI] job_failed job={JobId}", job.Id);
            job.Status = LettreConfrereAiJobStatuses.Failed;
            job.Error = Truncate(BuildFriendlyError(ex), 500);
            job.CompletedAtUtc = DateTime.UtcNow;
            await db.SaveChangesAsync(CancellationToken.None);
            await NotifyJobSafelyAsync(job);
        }
    }

    private async Task<string> GenerateLetterAsync(
        ConsultationLettreConfrereAiJob job,
        LetterContext context,
        CancellationToken cancellationToken)
    {
        var messages = new[]
        {
            new OpenRouterMessage(
                "system",
                string.Join('\n', new[]
                {
                    "Tu es un assistant redactionnel pour un dermatologue.",
                    "Ta mission: rÃ©diger le CORPS d'une lettre professionnelle destinÃ©e Ã  un confrÃ¨re ou une consÅ“ur.",
                    "",
                    "RÃˆGLES DE SORTIE:",
                    "- RÃˆGLE DE LANGUE PRIORITAIRE: rÃ©dige contenue dans la mÃªme langue que l'instruction utilisateur.",
                    "- Si la description demandÃ©e est en arabe, contenue doit Ãªtre en arabe; si elle est en franÃ§ais, en franÃ§ais; si elle est en anglais, en anglais.",
                    "- Ne traduis jamais vers le franÃ§ais ou l'anglais par dÃ©faut.",
                    "- Retourne UNIQUEMENT un JSON valide, sans markdown.",
                    "- ClÃ©s obligatoires: medecin, formulepolitesse, contenue.",
                    "- medecin et formulepolitesse sont des mÃ©tadonnÃ©es fournies par l'application: recopie-les telles quelles si elles sont prÃ©sentes.",
                    "- Utilise formulepolitesse pour adapter le genre en franÃ§ais ou en arabe.",
                    "- contenue: uniquement le corps de la lettre.",
                    "- N'Ã©cris jamais dans contenue la formule de politesse, le destinataire, un appel de type Cher confrÃ¨re/ChÃ¨re consÅ“ur, ni une signature.",
                    "- N'invente aucune information clinique absente de la description ou du contexte.",
                    "- Utilise le contexte consultation seulement s'il est pertinent pour la demande.",
                    "- Format de contenue: HTML simple avec <p> et <br>."
                })),
            new OpenRouterMessage(
                "user",
                string.Join('\n', new[]
                {
                    $"Destinataire actuel: {job.Medecin.DefaultIfEmpty("(vide)")}",
                    $"Formule actuelle: {job.Formulepolitesse.DefaultIfEmpty("Cher confrÃ¨re")}",
                    "Langue de sortie: mÃªme langue que la description demandÃ©e.",
                    $"Description demandÃ©e: {job.GeneralDescription}",
                    string.IsNullOrWhiteSpace(job.SourceContent)
                        ? string.Empty
                        : $"Contenu actuel Ã  prendre en compte: {job.SourceContent}",
                    "",
                    "--- Contexte consultation indicatif ---",
                    context.ToPrompt()
                }.Where(line => !string.IsNullOrWhiteSpace(line))))
        };

        return await CompleteWithOpenRouterAsync(messages, 0.2, cancellationToken);
    }

    private async Task<string> CorrectLetterAsync(
        ConsultationLettreConfrereAiJob job,
        LetterContext context,
        CancellationToken cancellationToken)
    {
        var messages = new[]
        {
            new OpenRouterMessage(
                "system",
                string.Join('\n', new[]
                {
                    "Tu es un assistant redactionnel pour un dermatologue.",
                    "Ta mission: corriger la langue, la fluiditÃ© et le ton professionnel du texte fourni sans changer son sens.",
                    "",
                    "RÃˆGLES DE SORTIE:",
                    "- RÃˆGLE DE LANGUE PRIORITAIRE: conserve la langue de l'instruction de correction si elle est fournie, sinon conserve la langue du texte Ã  corriger.",
                    "- Si l'instruction ou le texte est en arabe, contenue doit Ãªtre en arabe; si c'est en franÃ§ais, en franÃ§ais; si c'est en anglais, en anglais.",
                    "- Ne traduis jamais vers le franÃ§ais ou l'anglais par dÃ©faut.",
                    "- Retourne UNIQUEMENT un JSON valide, sans markdown.",
                    "- ClÃ©s obligatoires: medecin, formulepolitesse, contenue.",
                    "- medecin et formulepolitesse sont des mÃ©tadonnÃ©es fournies par l'application: recopie-les telles quelles si elles sont prÃ©sentes.",
                    "- Utilise formulepolitesse pour adapter le genre en franÃ§ais ou en arabe.",
                    "- contenue: uniquement le corps corrigÃ©.",
                    "- N'Ã©cris jamais dans contenue la formule de politesse, le destinataire, un appel de type Cher confrÃ¨re/ChÃ¨re consÅ“ur, ni une signature.",
                    "- N'ajoute aucune information absente du texte original.",
                    "- Format de contenue: HTML simple avec <p> et <br>."
                })),
            new OpenRouterMessage(
                "user",
                string.Join('\n', new[]
                {
                    $"Destinataire: {job.Medecin.DefaultIfEmpty("(vide)")}",
                    $"Formule actuelle: {job.Formulepolitesse.DefaultIfEmpty("Cher confrÃ¨re")}",
                    "Langue de sortie: mÃªme langue que l'instruction de correction si elle est fournie, sinon mÃªme langue que le texte Ã  corriger.",
                    string.IsNullOrWhiteSpace(job.CorrectionPrompt)
                        ? string.Empty
                        : $"Instruction de correction: {job.CorrectionPrompt}",
                    "",
                    "--- Contexte consultation indicatif, ne pas inventer ---",
                    context.ToPrompt(),
                    "",
                    "Texte Ã  corriger:",
                    job.SourceContent
                }.Where(line => !string.IsNullOrWhiteSpace(line))))
        };

        return await CompleteWithOpenRouterAsync(messages, 0.1, cancellationToken);
    }

    private async Task<string> CompleteWithOpenRouterAsync(
        IReadOnlyList<OpenRouterMessage> messages,
        double temperature,
        CancellationToken cancellationToken)
    {
        var apiKey = ReadRequiredEnv("openrouter_api_key", "OPENROUTER_API_KEY");
        var endpoint = ReadOptionalEnv("openrouter_base_url", "OPENROUTER_BASE_URL");
        endpoint = string.IsNullOrWhiteSpace(endpoint) ? "https://openrouter.ai/api/v1" : endpoint;
        var model = ReadRequiredEnv(
            "openrouter_letter_ai_model",
            "OPENROUTER_FAST_MODEL",
            "openrouter_ai_model",
            "OPENROUTER_AI_MODEL");
        var fallbackModel = ReadOptionalEnv("openrouter_fallback_ai_model", "OPENROUTER_FALLBACK_AI_MODEL");

        try
        {
            return await CompleteWithOpenRouterModelAsync(
                apiKey,
                endpoint,
                model,
                messages,
                temperature,
                cancellationToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException &&
                                   !string.IsNullOrWhiteSpace(fallbackModel) &&
                                   !string.Equals(fallbackModel, model, StringComparison.OrdinalIgnoreCase))
        {
            return await CompleteWithOpenRouterModelAsync(
                apiKey,
                endpoint,
                fallbackModel,
                messages,
                temperature,
                cancellationToken);
        }
    }

    private static async Task<string> CompleteWithOpenRouterModelAsync(
        string apiKey,
        string endpoint,
        string model,
        IReadOnlyList<OpenRouterMessage> messages,
        double temperature,
        CancellationToken cancellationToken)
    {
        using var httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(90) };
        httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        httpClient.DefaultRequestHeaders.TryAddWithoutValidation(
            "HTTP-Referer",
            ReadOptionalEnv("openrouter_http_referer", "OPENROUTER_REFERER").DefaultIfEmpty("https://generalisto.app"));
        httpClient.DefaultRequestHeaders.TryAddWithoutValidation("X-Title", "Dermatologo");

        var body = new
        {
            model,
            messages,
            max_tokens = MaxLetterTokens,
            temperature,
            stream = false
        };

        using var content = new StringContent(
            JsonSerializer.Serialize(body, JsonOptions),
            Encoding.UTF8,
            "application/json");

        using var response = await httpClient.PostAsync(
            $"{endpoint.TrimEnd('/')}/chat/completions",
            content,
            cancellationToken);

        var payload = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException(BuildOpenRouterError((int)response.StatusCode, payload));
        }

        using var document = JsonDocument.Parse(payload);
        var root = document.RootElement;
        if (root.TryGetProperty("error", out var error))
        {
            var message = error.TryGetProperty("message", out var messageElement)
                ? messageElement.GetString()
                : "Erreur OpenRouter inconnue.";
            throw new InvalidOperationException(message ?? "Erreur OpenRouter inconnue.");
        }

        var assistantText = root
            .GetProperty("choices")[0]
            .GetProperty("message")
            .GetProperty("content")
            .GetString();

        if (string.IsNullOrWhiteSpace(assistantText))
        {
            throw new InvalidOperationException("OpenRouter a rÃ©pondu sans texte.");
        }

        return assistantText.Trim();
    }

    private async Task<LetterContext> BuildLetterContextAsync(
        Guid consultationId,
        Guid cabinetIdentityId,
        CancellationToken cancellationToken)
    {
        var consultation = await db.Consultations
            .AsNoTracking()
            .Include(c => c.Patient)
            .Include(c => c.Motifs)
            .Include(c => c.Interrogatoire)
                .ThenInclude(i => i.OngoingTreatments)
            .FirstOrDefaultAsync(
                c => c.Id == consultationId && c.CabinetIdentityId == cabinetIdentityId,
                cancellationToken);

        if (consultation is null)
        {
            throw new InvalidOperationException("Consultation not found.");
        }

        var patient = consultation.Patient;
        var age = CalculateAge(patient.DateOfBirth, DateTime.UtcNow);
        var treatments = consultation.Interrogatoire.OngoingTreatments
            .Select(item => string.Join(" - ", new[]
            {
                item.Medicine,
                item.Posology,
                item.Duration
            }.Where(value => !string.IsNullOrWhiteSpace(value))))
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .ToList();

        return new LetterContext(
            PatientFullName: $"{patient.Lastname} {patient.Firstname}".Trim(),
            PatientAge: age > 0 ? $"{age} ans" : string.Empty,
            PatientSex: patient.Sex,
            Motifs: string.Join(", ", consultation.Motifs.OrderBy(item => item.CreatedAt).Select(item => item.Value)),
            HistoireMaladie: consultation.Interrogatoire.HistoireMaladie,
            Diagnostics: string.Join(", ", consultation.Interrogatoire.Diagnostics ?? Array.Empty<string>()),
            OngoingTreatments: string.Join("; ", treatments),
            AdditionalInformation: consultation.ConduiteAdditionalInformation);
    }

    private async Task UpsertLettreActionAsync(
        Guid consultationId,
        Dictionary<string, JsonElement> payload,
        CancellationToken cancellationToken)
    {
        var existing = await db.ConsultationConduiteActions
            .FirstOrDefaultAsync(
                item => item.ConsultationId == consultationId &&
                        item.ActionKey == ConduiteActionKeys.LettreConfrere,
                cancellationToken);

        if (existing is not null)
        {
            existing.Payload = ClonePayload(payload);
            return;
        }

        var maxSortOrder = await db.ConsultationConduiteActions
            .Where(item => item.ConsultationId == consultationId)
            .Select(item => (int?)item.SortOrder)
            .MaxAsync(cancellationToken) ?? -1;

        db.ConsultationConduiteActions.Add(new ConsultationConduiteAction
        {
            Id = Guid.NewGuid(),
            ConsultationId = consultationId,
            ActionKey = ConduiteActionKeys.LettreConfrere,
            SortOrder = maxSortOrder + 1,
            Payload = ClonePayload(payload),
        });
    }

    private async Task EnsureConsultationOwnershipAsync(Guid consultationId, Guid cabinetIdentityId)
    {
        var exists = await db.Consultations
            .AsNoTracking()
            .AnyAsync(item => item.Id == consultationId && item.CabinetIdentityId == cabinetIdentityId);

        if (!exists)
        {
            throw new InvalidOperationException("Consultation not found.");
        }
    }

    private async Task ScheduleJobAsync(Guid jobId)
    {
        var scheduler = await schedulerFactory.GetScheduler();
        var job = JobBuilder
            .Create<LettreConfrereAiQuartzJob>()
            .WithIdentity($"lettre-ai-{jobId:N}", "lettre-confrere-ai")
            .UsingJobData("jobId", jobId.ToString("D"))
            .Build();
        var trigger = TriggerBuilder
            .Create()
            .WithIdentity($"lettre-ai-trigger-{jobId:N}", "lettre-confrere-ai")
            .StartNow()
            .Build();

        await scheduler.ScheduleJob(job, trigger);
    }

    private async Task NotifyJobSafelyAsync(ConsultationLettreConfrereAiJob job)
    {
        try
        {
            await notifier.NotifyJobUpdated(new ConsultationAiRealtimeEvent
            {
                CabinetIdentityId = job.CabinetIdentityId,
                ConsultationId = job.ConsultationId,
                JobId = job.Id,
                Operation = job.Operation,
                Status = job.Status,
                Error = job.Error,
            });
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "[LETTRE_AI] notify_failed job={JobId}", job.Id);
        }
    }

    private static LettreConfrereAiJobResponse MapJob(ConsultationLettreConfrereAiJob job)
        => new()
        {
            Id = job.Id,
            ConsultationId = job.ConsultationId,
            Operation = job.Operation,
            Status = job.Status,
            ResultPayload = ClonePayload(job.ResultPayload),
            Error = job.Error,
            CreatedAt = job.CreatedAt,
            UpdatedAt = job.UpdatedAt,
            CompletedAtUtc = job.CompletedAtUtc,
        };

    private static Dictionary<string, JsonElement> ExtractLettrePayload(
        string rawAiText,
        string fallbackMedecin,
        string fallbackFormule)
    {
        var json = ExtractJsonObject(rawAiText);
        if (string.IsNullOrWhiteSpace(json))
        {
            throw new InvalidOperationException("La rÃ©ponse IA ne contient pas de JSON valide.");
        }

        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;
        var aiMedecin = ReadJsonString(root, "medecin", "recipient", "destinataire");
        var aiFormule = ReadJsonString(root, "formulepolitesse", "formulePolitesse", "formality");
        var medecin = Truncate(
            fallbackMedecin.DefaultIfEmpty(aiMedecin),
            180);
        var rawFormule = fallbackFormule.DefaultIfEmpty(aiFormule);
        var formule = Truncate(rawFormule.DefaultIfEmpty(NormalizeFormule(rawFormule)), 80);
        var contenue = SanitizeLetterHtml(ReadJsonString(root, "contenue", "contenu", "content"));

        if (string.IsNullOrWhiteSpace(StripHtml(contenue)))
        {
            throw new InvalidOperationException("La rÃ©ponse IA ne contient pas de lettre exploitable.");
        }

        return BuildPayload(new Dictionary<string, object?>
        {
            ["medecin"] = medecin,
            ["formalityKey"] = ResolveFormalityKey(formule),
            ["formulepolitesse"] = formule,
            ["contenue"] = contenue,
        });
    }

    private static Dictionary<string, JsonElement> BuildPayload(Dictionary<string, object?> values)
    {
        using var document = JsonDocument.Parse(JsonSerializer.Serialize(values, JsonOptions));
        return document.RootElement
            .EnumerateObject()
            .ToDictionary(property => property.Name, property => property.Value.Clone(), StringComparer.Ordinal);
    }

    private static Dictionary<string, JsonElement> ClonePayload(Dictionary<string, JsonElement>? payload)
    {
        if (payload is null || payload.Count == 0)
        {
            return new Dictionary<string, JsonElement>(StringComparer.Ordinal);
        }

        var clone = new Dictionary<string, JsonElement>(payload.Count, StringComparer.Ordinal);
        foreach (var item in payload)
        {
            using var document = JsonDocument.Parse(item.Value.GetRawText());
            clone[item.Key] = document.RootElement.Clone();
        }

        return clone;
    }

    private static string ReadJsonString(JsonElement root, params string[] names)
    {
        foreach (var property in root.EnumerateObject())
        {
            if (!names.Any(name => string.Equals(property.Name, name, StringComparison.OrdinalIgnoreCase)))
            {
                continue;
            }

            return property.Value.ValueKind switch
            {
                JsonValueKind.String => property.Value.GetString()?.Trim() ?? string.Empty,
                JsonValueKind.Number => property.Value.ToString(),
                JsonValueKind.True => "true",
                JsonValueKind.False => "false",
                _ => string.Empty,
            };
        }

        return string.Empty;
    }

    private static string ExtractJsonObject(string raw)
    {
        raw = NormalizeText(raw);
        if (raw.StartsWith('{') && raw.EndsWith('}'))
        {
            return raw;
        }

        var start = raw.IndexOf('{');
        var end = raw.LastIndexOf('}');
        return start >= 0 && end > start ? raw[start..(end + 1)] : string.Empty;
    }

    private static string SanitizeLetterHtml(string value)
    {
        var sanitized = Regex.Replace(
            value,
            @"<\s*(script|style)[^>]*>.*?<\s*/\s*\1\s*>",
            string.Empty,
            RegexOptions.IgnoreCase | RegexOptions.Singleline);

        sanitized = RemoveGeneratedLetterChrome(sanitized);

        return sanitized.Trim();
    }

    private static string RemoveGeneratedLetterChrome(string value)
    {
        var sanitized = value.Trim();
        var openingFormula =
            @"(?:cher\s+confr(?:e|Ã¨)re|ch(?:e|Ã¨)re\s+cons(?:oe|Å“)ur|dear\s+colleague|cher\s+coll(?:e|Ã¨)gue|Ø²Ù…ÙŠÙ„ÙŠ\s+Ø§Ù„Ø¹Ø²ÙŠØ²|Ø²Ù…ÙŠÙ„ØªÙŠ\s+Ø§Ù„Ø¹Ø²ÙŠØ²Ø©)";

        sanitized = Regex.Replace(
            sanitized,
            @"^\s*<p>\s*" + openingFormula + @"\s*[,ØŒ]?\s*</p>\s*",
            string.Empty,
            RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

        sanitized = Regex.Replace(
            sanitized,
            @"^\s*<p>\s*" + openingFormula + @"\s*[,ØŒ]?\s*<br\s*/?>\s*",
            "<p>",
            RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

        sanitized = Regex.Replace(
            sanitized,
            @"^\s*" + openingFormula + @"\s*[,ØŒ]?\s*(<br\s*/?>|\r?\n)+",
            string.Empty,
            RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

        return sanitized;
    }

    private static string StripHtml(string value)
        => Regex.Replace(value, "<.*?>", " ").Trim();

    private static string NormalizeFormule(string? value)
    {
        var normalized = NormalizeToken(value);
        if (normalized.Contains("consoeur") || normalized.Contains("consÅ“ur") || normalized.Contains("chere"))
        {
            return "ChÃ¨re consÅ“ur";
        }

        return "Cher confrÃ¨re";
    }

    private static string ResolveFormalityKey(string formule)
    {
        var normalized = NormalizeToken(formule);
        return normalized.Contains("consoeur")
            || normalized.Contains("consÅ“ur")
            || normalized.Contains("Ø²Ù…ÙŠÙ„ØªÙŠ")
            || normalized.Contains("Ø²Ù…ÙŠÙ„Ø©")
            ? "consoeur"
            : "confrere";
    }

    private static string NormalizeToken(string? value)
        => NormalizeText(value)
            .Normalize(NormalizationForm.FormD)
            .Where(ch => CharUnicodeInfo.GetUnicodeCategory(ch) != UnicodeCategory.NonSpacingMark)
            .Aggregate(new StringBuilder(), (builder, ch) => builder.Append(char.ToLowerInvariant(ch)))
            .ToString();

    private static string NormalizeText(string? value)
        => string.IsNullOrWhiteSpace(value)
            ? string.Empty
            : value.Trim();

    private static string Truncate(string value, int maxLength)
        => value.Length <= maxLength ? value : value[..maxLength].TrimEnd();

    private static int CalculateAge(DateTime birthDate, DateTime today)
    {
        var age = today.Year - birthDate.Year;
        if (birthDate.Date > today.Date.AddYears(-age))
        {
            age--;
        }

        return age;
    }

    private static string ReadRequiredEnv(params string[] names)
    {
        var value = ReadOptionalEnv(names);
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new InvalidOperationException($"Configuration OpenRouter manquante: {names[0]}.");
        }

        return value;
    }

    private static string ReadOptionalEnv(params string[] names)
    {
        foreach (var name in names)
        {
            var value = Environment.GetEnvironmentVariable(name)?.Trim();
            if (!string.IsNullOrWhiteSpace(value))
            {
                return value;
            }
        }

        return string.Empty;
    }

    private static string BuildOpenRouterError(int statusCode, string payload)
    {
        try
        {
            using var document = JsonDocument.Parse(payload);
            if (document.RootElement.TryGetProperty("error", out var error) &&
                error.TryGetProperty("message", out var messageElement))
            {
                var message = messageElement.GetString();
                if (!string.IsNullOrWhiteSpace(message))
                {
                    return $"OpenRouter a refusÃ© la requÃªte ({statusCode}): {message}";
                }
            }
        }
        catch
        {
            // Fall through to compact raw payload.
        }

        return $"OpenRouter a refusÃ© la requÃªte ({statusCode}).";
    }

    private static string BuildFriendlyError(Exception ex)
    {
        var message = ex.Message;
        if (message.Contains("401", StringComparison.OrdinalIgnoreCase) ||
            message.Contains("unauthorized", StringComparison.OrdinalIgnoreCase))
        {
            return "OpenRouter a refusÃ© la clÃ© API. VÃ©rifiez openrouter_api_key.";
        }

        if (message.Contains("model", StringComparison.OrdinalIgnoreCase) ||
            message.Contains("404", StringComparison.OrdinalIgnoreCase))
        {
            return "Le modÃ¨le OpenRouter configurÃ© est introuvable ou indisponible.";
        }

        if (message.Contains("timeout", StringComparison.OrdinalIgnoreCase) ||
            message.Contains("timed out", StringComparison.OrdinalIgnoreCase))
        {
            return "La rÃ©ponse de l'assistant a pris trop de temps. RÃ©essayez.";
        }

        return string.IsNullOrWhiteSpace(message)
            ? "Impossible d'obtenir une rÃ©ponse IA pour la lettre."
            : message;
    }

    private sealed record OpenRouterMessage(string Role, string Content);

    private sealed record LetterContext(
        string PatientFullName,
        string PatientAge,
        string PatientSex,
        string Motifs,
        string HistoireMaladie,
        string Diagnostics,
        string OngoingTreatments,
        string AdditionalInformation)
    {
        public string ToPrompt()
            => string.Join('\n', new[]
            {
                $"Patient: {PatientFullName.DefaultIfEmpty("Non prÃ©cisÃ©")}",
                $"Age: {PatientAge.DefaultIfEmpty("Non prÃ©cisÃ©")}",
                $"Sexe: {PatientSex.DefaultIfEmpty("Non prÃ©cisÃ©")}",
                $"Motifs: {Motifs.DefaultIfEmpty("Non prÃ©cisÃ©s")}",
                $"Histoire de la maladie: {HistoireMaladie.DefaultIfEmpty("Non prÃ©cisÃ©e")}",
                $"Diagnostics: {Diagnostics.DefaultIfEmpty("Non prÃ©cisÃ©s")}",
                $"Traitements en cours: {OngoingTreatments.DefaultIfEmpty("Non prÃ©cisÃ©s")}",
                $"Informations CAT: {AdditionalInformation.DefaultIfEmpty("Non prÃ©cisÃ©es")}",
            });
    }
}

file static class LettreConfrereAiStringExtensions
{
    public static string DefaultIfEmpty(this string? value, string fallback)
        => string.IsNullOrWhiteSpace(value) ? fallback : value.Trim();
}
