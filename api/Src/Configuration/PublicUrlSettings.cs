using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;

namespace api.Src.Configuration;

public sealed record PublicUrlSettings(
    string FrontendUrl,
    string ApiUrl,
    IReadOnlyList<string> CorsOrigins)
{
    public string LoginUrl => PublicUrlSettingsReader.BuildUrl(FrontendUrl, "login");
    public string ResetPasswordUrl => PublicUrlSettingsReader.BuildUrl(FrontendUrl, "reset-password");

    public bool IsCorsOriginAllowed(string? origin)
    {
        if (string.IsNullOrWhiteSpace(origin))
        {
            return false;
        }

        var normalizedOrigin = PublicUrlSettingsReader.NormalizeOrigin(origin);
        return !string.IsNullOrWhiteSpace(normalizedOrigin) &&
               CorsOrigins.Contains(normalizedOrigin, StringComparer.OrdinalIgnoreCase);
    }
}

public static class PublicUrlSettingsReader
{
    private static readonly string[] DevelopmentCorsOrigins =
    [
        "http://localhost:4200",
        "https://localhost:4200",
        "http://localhost:3000",
        "https://localhost:3000",
        "http://localhost:5173",
        "https://localhost:5173"
    ];

    public static PublicUrlSettings Read(
        IConfiguration configuration,
        IWebHostEnvironment? environment = null)
    {
        var frontendUrl = NormalizeBaseUrl(ReadSetting(
            configuration,
            "AppUrls:FrontendUrl",
            "frontend_url",
            "https://generalisto.softsolution.site"));

        var apiUrl = NormalizeBaseUrl(ReadSetting(
            configuration,
            "AppUrls:ApiUrl",
            "api_public_url",
            "https://gen-api.softsolution.site"));

        var origins = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        AddOrigin(origins, frontendUrl);

        foreach (var origin in SplitList(ReadSetting(
            configuration,
            "AppUrls:CorsOrigins",
            "cors_allowed_origins",
            frontendUrl)))
        {
            AddOrigin(origins, origin);
        }

        if (environment?.IsDevelopment() == true)
        {
            foreach (var origin in DevelopmentCorsOrigins)
            {
                AddOrigin(origins, origin);
            }
        }

        return new PublicUrlSettings(frontendUrl, apiUrl, origins.ToList());
    }

    public static string ReadSetting(
        IConfiguration configuration,
        string configurationKey,
        string environmentVariableName,
        string fallback)
    {
        var envValue = Environment.GetEnvironmentVariable(environmentVariableName)?.Trim();
        if (!string.IsNullOrWhiteSpace(envValue))
        {
            return envValue;
        }

        var configuredValue = configuration[configurationKey]?.Trim();
        return !string.IsNullOrWhiteSpace(configuredValue)
            ? configuredValue
            : fallback;
    }

    public static string BuildUrl(string baseUrl, string path)
    {
        var normalizedBaseUrl = NormalizeBaseUrl(baseUrl);
        var normalizedPath = path.TrimStart('/');
        return string.IsNullOrWhiteSpace(normalizedPath)
            ? normalizedBaseUrl
            : $"{normalizedBaseUrl}/{normalizedPath}";
    }

    public static string NormalizeBaseUrl(string value)
    {
        return value.Trim().TrimEnd('/');
    }

    private static IEnumerable<string> SplitList(string value)
    {
        return value.Split(
            [',', ';', '\r', '\n'],
            StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
    }

    private static void AddOrigin(ISet<string> origins, string value)
    {
        var normalized = NormalizeOrigin(value);
        if (!string.IsNullOrWhiteSpace(normalized))
        {
            origins.Add(normalized);
        }
    }

    public static string NormalizeOrigin(string value)
    {
        var normalized = NormalizeBaseUrl(value);
        if (!Uri.TryCreate(normalized, UriKind.Absolute, out var uri) ||
            string.IsNullOrWhiteSpace(uri.Scheme) ||
            string.IsNullOrWhiteSpace(uri.Host))
        {
            return string.Empty;
        }

        return uri.GetLeftPart(UriPartial.Authority);
    }
}
