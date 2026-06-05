namespace api.Src.ConsultationSpace.ConduiteSection;

public static class ConduiteActionKeys
{
    public const string Ordonnance = "ordonnance";
    public const string Certificat = "certificat";
    public const string LettreConfrere = "lettre_confrere";
    public const string Cnam = "cnam";

    public const string ParacliniqueChirurgie = "paraclinique_chirurgie";
    public const string ParacliniqueImagerie = "paraclinique_imagerie";
    public const string ParacliniqueBilanSanguin = "paraclinique_bilan_sanguin";

    public static readonly IReadOnlySet<string> AllowedActionKeys = new HashSet<string>(
        StringComparer.OrdinalIgnoreCase)
    {
        Ordonnance,
        Certificat,
        LettreConfrere,
        Cnam,
        ParacliniqueChirurgie,
        ParacliniqueImagerie,
        ParacliniqueBilanSanguin,
    };

    public static readonly IReadOnlySet<string> AllowedDocumentTypes = new HashSet<string>(
        StringComparer.OrdinalIgnoreCase)
    {
        "ordonnance",
        "certificat",
        "lettre_confrere",
        "paraclinique",
    };

    public static string NormalizeActionKey(string raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return string.Empty;
        }

        return raw
            .Trim()
            .ToLowerInvariant()
            .Replace('-', '_')
            .Replace(' ', '_');
    }

    public static string NormalizeDocumentType(string raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return string.Empty;
        }

        return raw
            .Trim()
            .ToLowerInvariant()
            .Replace('-', '_')
            .Replace(' ', '_');
    }

    public static bool IsParacliniqueAction(string actionKey)
    {
        var normalized = NormalizeActionKey(actionKey);
        return normalized.StartsWith("paraclinique_", StringComparison.Ordinal);
    }
}
