using System.Text;
using System.Text.RegularExpressions;

namespace api.Src.ConsultationSpace.ConduiteSection.Services;

public partial class ConduitePrintService
{
    private static readonly Regex HtmlCommentRegex = new(
        "<!--.*?-->",
        RegexOptions.Compiled | RegexOptions.Singleline,
        TimeSpan.FromMilliseconds(250));

    private static readonly Regex DangerousBlockTagRegex = new(
        @"<\s*(script|style|iframe|object|embed|form|textarea|button|input|svg|math)[^>]*>.*?<\s*/\s*\1\s*>",
        RegexOptions.Compiled | RegexOptions.IgnoreCase | RegexOptions.Singleline,
        TimeSpan.FromMilliseconds(250));

    private static readonly Regex DangerousSingleTagRegex = new(
        @"<\s*(script|style|iframe|object|embed|form|textarea|button|input|svg|math)[^>]*?/?>",
        RegexOptions.Compiled | RegexOptions.IgnoreCase,
        TimeSpan.FromMilliseconds(250));

    private static readonly Regex AnyHtmlTagRegex = new(
        @"<\s*(?<slash>/)?\s*(?<tag>[a-zA-Z0-9]+)(?:\s+[^>]*)?\s*/?\s*>",
        RegexOptions.Compiled | RegexOptions.Singleline,
        TimeSpan.FromMilliseconds(250));

    private static readonly Regex RemoveTagsRegex = new(
        @"<[^>]+>",
        RegexOptions.Compiled | RegexOptions.Singleline,
        TimeSpan.FromMilliseconds(250));

    private static readonly HashSet<string> AllowedRichTextTags = new(StringComparer.Ordinal)
    {
        "p",
        "br",
        "div",
        "span",
        "strong",
        "b",
        "em",
        "i",
        "u",
        "ul",
        "ol",
        "li",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "blockquote",
    };

    private static readonly HashSet<string> SelfClosingAllowedTags = new(StringComparer.Ordinal)
    {
        "br",
    };

    private static string BuildLettreConfrereBody(PrintContext context, PrintLocale locale)
    {
        if (!context.ActionsByKey.TryGetValue(ConduiteActionKeys.LettreConfrere, out var action))
        {
            return $"<div class=\"body-block\"><h3>{EscapeHtml(locale.LettreConfrereTitle)}</h3><p>{EscapeHtml(GetNoLettreRecordedMessage(locale))}</p></div>";
        }

        var medecin = ReadString(action.Payload, "medecin");
        var formality = ResolveLettreFormality(
            ReadString(action.Payload, "formalityKey"),
            ReadString(action.Payload, "formulepolitesse"),
            locale);
        var formule = BuildLettreFormule(formality, locale);
        var contenu = ReadString(action.Payload, "contenue");

        var sb = new StringBuilder();
        sb.Append($"<div class=\"body-block\"><h3>{EscapeHtml(locale.LettreConfrereTitle)}</h3>");

        if (!string.IsNullOrWhiteSpace(medecin))
        {
            sb.Append($"<p><span class=\"label\">{EscapeHtml(GetLettreRecipientLabel(locale))}</span> {EscapeHtml(medecin)}</p>");
        }

        sb.Append($"<p>{EscapeHtml(formule)},</p>");
        sb.Append($"<div class=\"lettre-confrere-content\">{BuildLettreContentHtml(contenu, locale)}</div>");
        sb.Append($"<p>{EscapeHtml(BuildDoctorDisplayName(context, locale))}</p>");
        sb.Append("</div>");
        return sb.ToString();
    }

    private static string ResolveLettreFormality(
        string rawFormality,
        string rawFormule,
        PrintLocale locale)
    {
        if (locale.LanguageCode == "en")
        {
            return "colleague";
        }

        var normalizedFormality = NormalizeGenericToken(rawFormality);
        if (normalizedFormality.Contains("consoeur", StringComparison.Ordinal))
        {
            return "consoeur";
        }

        if (normalizedFormality.Contains("confrere", StringComparison.Ordinal))
        {
            return "confrere";
        }

        if (rawFormule.Contains("زميلة", StringComparison.Ordinal))
        {
            return "consoeur";
        }

        if (rawFormule.Contains("زميل", StringComparison.Ordinal))
        {
            return "confrere";
        }

        var normalizedFormule = NormalizeGenericToken(rawFormule);
        if (normalizedFormule.Contains("consoeur", StringComparison.Ordinal))
        {
            return "consoeur";
        }

        if (normalizedFormule.Contains("confrere", StringComparison.Ordinal))
        {
            return "confrere";
        }

        return "confrere";
    }

    private static string BuildLettreFormule(string formality, PrintLocale locale)
    {
        if (locale.LanguageCode == "en")
        {
            return "Dear colleague";
        }

        if (locale.LanguageCode == "ar")
        {
            return string.Equals(formality, "consoeur", StringComparison.Ordinal)
                ? "زميلتي العزيزة"
                : "زميلي العزيز";
        }

        return string.Equals(formality, "consoeur", StringComparison.Ordinal)
            ? "Chère consœur"
            : "Cher confrère";
    }

    private static string BuildLettreContentHtml(string rawContent, PrintLocale locale)
    {
        if (string.IsNullOrWhiteSpace(rawContent))
        {
            return $"<p>{EscapeHtml(GetNoLettreContentMessage(locale))}</p>";
        }

        if (!LooksLikeHtml(rawContent))
        {
            return $"<p>{Nl2Br(rawContent)}</p>";
        }

        var sanitizedHtml = SanitizeRichTextHtml(rawContent);
        if (string.IsNullOrWhiteSpace(sanitizedHtml))
        {
            return $"<p>{EscapeHtml(GetNoLettreContentMessage(locale))}</p>";
        }

        var textOnly = RemoveTagsRegex.Replace(sanitizedHtml, string.Empty)
            .Replace("&nbsp;", " ", StringComparison.Ordinal)
            .Trim();

        if (string.IsNullOrWhiteSpace(textOnly))
        {
            return $"<p>{EscapeHtml(GetNoLettreContentMessage(locale))}</p>";
        }

        if (!AnyHtmlTagRegex.IsMatch(sanitizedHtml))
        {
            return $"<p>{Nl2Br(sanitizedHtml)}</p>";
        }

        return sanitizedHtml;
    }

    private static bool LooksLikeHtml(string value)
    {
        var firstOpenTagIndex = value.IndexOf('<', StringComparison.Ordinal);
        if (firstOpenTagIndex < 0)
        {
            return false;
        }

        var firstCloseTagIndex = value.IndexOf('>', firstOpenTagIndex + 1);
        return firstCloseTagIndex > firstOpenTagIndex;
    }

    private static string SanitizeRichTextHtml(string rawHtml)
    {
        if (string.IsNullOrWhiteSpace(rawHtml))
        {
            return string.Empty;
        }

        var sanitized = rawHtml.Replace("\r", string.Empty, StringComparison.Ordinal);
        sanitized = HtmlCommentRegex.Replace(sanitized, string.Empty);
        sanitized = DangerousBlockTagRegex.Replace(sanitized, string.Empty);
        sanitized = DangerousSingleTagRegex.Replace(sanitized, string.Empty);

        sanitized = AnyHtmlTagRegex.Replace(sanitized, match =>
        {
            var rawTag = match.Groups["tag"].Value;
            if (string.IsNullOrWhiteSpace(rawTag))
            {
                return string.Empty;
            }

            var tag = rawTag.ToLowerInvariant();
            if (!AllowedRichTextTags.Contains(tag))
            {
                return string.Empty;
            }

            var isClosingTag = string.Equals(match.Groups["slash"].Value, "/", StringComparison.Ordinal);
            if (isClosingTag)
            {
                return $"</{tag}>";
            }

            if (SelfClosingAllowedTags.Contains(tag))
            {
                return $"<{tag} />";
            }

            return $"<{tag}>";
        });

        return sanitized.Trim();
    }

    private static string GetNoLettreRecordedMessage(PrintLocale locale)
    {
        return locale.LanguageCode switch
        {
            "ar" => "لا توجد رسالة مسجلة.",
            "en" => "No letter recorded.",
            _ => "Aucune lettre enregistree.",
        };
    }

    private static string GetNoLettreContentMessage(PrintLocale locale)
    {
        return locale.LanguageCode switch
        {
            "ar" => "لم يتم إدخال محتوى الرسالة.",
            "en" => "Letter content is not specified.",
            _ => "Contenu non renseigne.",
        };
    }

    private static string GetLettreRecipientLabel(PrintLocale locale)
    {
        return locale.LanguageCode switch
        {
            "ar" => "المستلم:",
            "en" => "Recipient:",
            _ => "Destinataire:",
        };
    }
}
