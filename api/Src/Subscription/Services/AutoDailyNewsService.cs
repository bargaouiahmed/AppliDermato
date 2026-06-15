using System.ClientModel;
using System.Text.Json;
using api.Src.Auth.Entities;
using Microsoft.EntityFrameworkCore;
using OpenAI;
using OpenAI.Chat;

namespace api.Src.Subscription.Services;

public sealed class AutoDailyNewsService(
    AppDbContext db,
    ILogger<AutoDailyNewsService> logger) : IAutoDailyNewsService
{
    private const int MinLength = 220;
    private const int MaxLength = 900;

    public async Task GenerateSuperAdminDailyNewsAsync(CancellationToken cancellationToken = default)
    {
        var superAdmin = await db.Doctors
            .Include(d => d.Personalization)
            .FirstOrDefaultAsync(d => d.Role == "super_admin", cancellationToken);

        if (superAdmin is null)
        {
            logger.LogWarning("[AUTO_DAILY_NEWS] super_admin_not_found");
            return;
        }

        superAdmin.Personalization ??= new DoctorPersonalization
        {
            DoctorId = superAdmin.Id,
            UseSuperAdminDailyNews = false
        };

        if (!superAdmin.Personalization.AutoDailyNewsEnabled)
        {
            logger.LogInformation("[AUTO_DAILY_NEWS] disabled_by_super_admin");
            return;
        }

        var previousSourceFr = NormalizeNullable(superAdmin.Personalization.DailyNewsFr ?? superAdmin.Personalization.DailyNews);

        var generated = await GenerateDetailedDailyNewsAsync(cancellationToken);
        if (generated is null)
        {
            logger.LogWarning("[AUTO_DAILY_NEWS] generation_empty_skip");
            return;
        }

        superAdmin.Personalization.DailyNewsFr = generated.Fr;
        superAdmin.Personalization.DailyNewsEn = generated.En;
        superAdmin.Personalization.DailyNewsAr = generated.Ar;
        superAdmin.Personalization.DailyNews = generated.Fr;
        superAdmin.Personalization.UseSuperAdminDailyNews = false;
        await db.SaveChangesAsync(cancellationToken);
        await PropagateSuperAdminDailyNewsAsync(previousSourceFr, cancellationToken);
        logger.LogInformation("[AUTO_DAILY_NEWS] super_admin_daily_news_updated lengthFr={Length}", generated.Fr.Length);
    }

    public async Task PropagateSuperAdminDailyNewsAsync(string? previousSourceFr = null, CancellationToken cancellationToken = default)
    {
        var superAdmin = await db.Doctors
            .AsNoTracking()
            .Include(d => d.Personalization)
            .FirstOrDefaultAsync(d => d.Role == "super_admin", cancellationToken);

        var sourceFr = NormalizeNullable(superAdmin?.Personalization?.DailyNewsFr ?? superAdmin?.Personalization?.DailyNews);
        var sourceEn = NormalizeNullable(superAdmin?.Personalization?.DailyNewsEn);
        var sourceAr = NormalizeNullable(superAdmin?.Personalization?.DailyNewsAr);
        var previousFr = NormalizeNullable(previousSourceFr);
        if (superAdmin is null)
        {
            return;
        }

        var doctors = await db.Doctors
            .Include(d => d.Personalization)
            .Where(d => d.Role != "super_admin")
            .ToListAsync(cancellationToken);

        foreach (var doctor in doctors)
        {
            doctor.Personalization ??= new DoctorPersonalization
            {
                DoctorId = doctor.Id,
            };

            var doctorFr = NormalizeNullable(doctor.Personalization.DailyNewsFr ?? doctor.Personalization.DailyNews);
            var sameAsSuperAdmin = string.Equals(doctorFr, sourceFr, StringComparison.Ordinal);
            var isEmptyDailyNews = string.IsNullOrWhiteSpace(doctorFr);
            var sameAsPreviousSuperAdmin = !string.IsNullOrWhiteSpace(previousFr) &&
                string.Equals(doctorFr, previousFr, StringComparison.Ordinal);
            if (sameAsSuperAdmin || isEmptyDailyNews || sameAsPreviousSuperAdmin)
            {
                doctor.Personalization.DailyNewsFr = sourceFr;
                doctor.Personalization.DailyNewsEn = sourceEn;
                doctor.Personalization.DailyNewsAr = sourceAr;
                doctor.Personalization.DailyNews = sourceFr;
                doctor.Personalization.UseSuperAdminDailyNews = true;
            }
        }

        await db.SaveChangesAsync(cancellationToken);
        logger.LogInformation("[AUTO_DAILY_NEWS] propagation_completed");
    }

    private async Task<DailyNewsPack?> GenerateDetailedDailyNewsAsync(CancellationToken cancellationToken)
    {
        var apiKey = Environment.GetEnvironmentVariable("openrouter_api_key")?.Trim();
        var model = Environment.GetEnvironmentVariable("openrouter_ai_model")?.Trim();
        var endpoint = Environment.GetEnvironmentVariable("openrouter_base_url")?.Trim();
        endpoint = string.IsNullOrWhiteSpace(endpoint) ? "https://openrouter.ai/api/v1" : endpoint;

        if (string.IsNullOrWhiteSpace(apiKey) || string.IsNullOrWhiteSpace(model))
        {
            logger.LogWarning("[AUTO_DAILY_NEWS] openrouter_config_missing");
            return null;
        }

        var client = new ChatClient(
            model,
            new ApiKeyCredential(apiKey),
            new OpenAIClientOptions { Endpoint = new Uri(endpoint) });

        var systemPrompt = string.Join('\n', [
            "Tu es un rédacteur scientifique expert en dermatologie.",
            "Tu dois produire UNE actualité dermatologique du jour, équivalente dans 3 langues (français, anglais, arabe) utile pour un dermatologue.",
            "",
            "RÈGLES STRICTES:",
            "- Réponds en JSON strict uniquement: {\"actualiteDuJourFr\":\"...\",\"actualiteDuJourEn\":\"...\",\"actualiteDuJourAr\":\"...\"}",
            $"- chaque champ: 3 à 5 phrases, entre {MinLength} et {MaxLength} caractères.",
            "- Commence directement par le fait clinique dermatologique (pas d'intro générique).",
            "- Donne du détail concret: pathologie cutanée, traitement/dispositif dermatologique, impact pratique, prudence clinique.",
            "- Focus exclusif: dermatologie (maladies de peau, traitements topiques/systémiques cutanés, nouvelles techniques dermatologiques).",
            "- Le contenu doit etre equivalent entre les 3 langues (meme information, pas de resume).",
            "- Si information evolutive, formule prudemment (ex: \"selon des donnees recentes\").",
            "- Pas de markdown, pas de balises HTML, pas d'emojis."
        ]);

        var messages = new List<ChatMessage>
        {
            new SystemChatMessage(systemPrompt),
            new UserChatMessage($"{{\"dateExecution\":\"{DateTime.UtcNow:O}\",\"consigneQualite\":\"actualite dermatologique detaillee utile pour le cabinet de dermatologie\"}}")
        };

        var completion = await client.CompleteChatAsync(messages, new ChatCompletionOptions
        {
            Temperature = 0.3f
        }, cancellationToken);

        var raw = completion.Value.Content.FirstOrDefault()?.Text?.Trim() ?? string.Empty;
        var json = ExtractJsonObject(raw);
        if (string.IsNullOrWhiteSpace(json))
        {
            return null;
        }

        using var document = JsonDocument.Parse(json);
        var fr = document.RootElement.TryGetProperty("actualiteDuJourFr", out var frValue)
            ? frValue.GetString() ?? string.Empty
            : string.Empty;
        var en = document.RootElement.TryGetProperty("actualiteDuJourEn", out var enValue)
            ? enValue.GetString() ?? string.Empty
            : string.Empty;
        var ar = document.RootElement.TryGetProperty("actualiteDuJourAr", out var arValue)
            ? arValue.GetString() ?? string.Empty
            : string.Empty;
        fr = fr.Trim();
        en = en.Trim();
        ar = ar.Trim();
        if (fr.Length < MinLength || en.Length < MinLength || ar.Length < MinLength)
        {
            return null;
        }

        fr = fr.Length > MaxLength ? fr[..MaxLength].TrimEnd() : fr;
        en = en.Length > MaxLength ? en[..MaxLength].TrimEnd() : en;
        ar = ar.Length > MaxLength ? ar[..MaxLength].TrimEnd() : ar;
        return new DailyNewsPack(fr, en, ar);
    }

    private static string ExtractJsonObject(string raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return string.Empty;
        }

        raw = raw.Trim();
        if (raw.StartsWith('{') && raw.EndsWith('}'))
        {
            return raw;
        }

        var start = raw.IndexOf('{');
        var end = raw.LastIndexOf('}');
        if (start < 0 || end <= start)
        {
            return string.Empty;
        }

        return raw[start..(end + 1)];
    }

    private static string? NormalizeNullable(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        return value.Trim();
    }

    private sealed record DailyNewsPack(string Fr, string En, string Ar);
}
