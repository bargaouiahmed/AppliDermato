using System.Text.Json;
using System.Globalization;
using System.Text;
using api.Src.ConsultationSpace.Catalogs;
using api.Src.ConsultationSpace.ConduiteSection.Dtos.Requests;
using api.Src.ConsultationSpace.ConduiteSection.Dtos.Responses;
using api.Src.ConsultationSpace.ConduiteSection.Entities;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace api.Src.ConsultationSpace.ConduiteSection.Services;

public class ConduiteService(AppDbContext db) : IConduiteService
{
    private static readonly IReadOnlyList<ConduiteCatalogItemResponse> DefaultCatalog =
    [
        new()
        {
            ActionKey = ConduiteActionKeys.Ordonnance,
            Label = "Prescrire une ordonnance",
            Category = "documents",
            IsParaclinique = false,
        },
        new()
        {
            ActionKey = ConduiteActionKeys.Certificat,
            Label = "Prescrire un certificat",
            Category = "documents",
            IsParaclinique = false,
        },
        new()
        {
            ActionKey = ConduiteActionKeys.LettreConfrere,
            Label = "Prescrire une lettre pour confrère",
            Category = "documents",
            IsParaclinique = false,
        },
        new()
        {
            ActionKey = ConduiteActionKeys.Cnam,
            Label = "Demander CNAM",
            Category = "documents",
            IsParaclinique = false,
        },
        new()
        {
            ActionKey = ConduiteActionKeys.ParacliniqueChirurgie,
            Label = "Paraclinique - Chirurgie",
            Category = "paraclinique",
            IsParaclinique = true,
        },
        new()
        {
            ActionKey = ConduiteActionKeys.ParacliniqueLaser,
            Label = "Paraclinique - Laser",
            Category = "paraclinique",
            IsParaclinique = true,
        },
        new()
        {
            ActionKey = ConduiteActionKeys.ParacliniqueImagerie,
            Label = "Paraclinique - Imagerie",
            Category = "paraclinique",
            IsParaclinique = true,
        },
        new()
        {
            ActionKey = ConduiteActionKeys.ParacliniqueBilanSanguin,
            Label = "Paraclinique - Bilan sanguin",
            Category = "paraclinique",
            IsParaclinique = true,
        },
    ];

    public Task<List<ConduiteCatalogItemResponse>> GetConduiteCatalog()
    {
        return Task.FromResult(DefaultCatalog.Select(item => new ConduiteCatalogItemResponse
        {
            ActionKey = item.ActionKey,
            Label = item.Label,
            Category = item.Category,
            IsParaclinique = item.IsParaclinique,
        }).ToList());
    }

    public async Task<List<ConduiteOrdonnanceTypeCatalogItemResponse>> GetOrdonnanceTypeCatalog(Guid cabinetIdentityId)
    {
        var types = GeneralPracticeCatalogDefaults.OrdonnanceTypeTemplates
            .Select((template, index) => new ConduiteOrdonnanceTypeCatalogItemResponse
            {
                TypeKey = template.TypeKey,
                Label = template.Label,
                TranslationKey = template.TranslationKey,
                SortOrder = index,
                Consigne = template.Consigne,
                InformationAdditionnel = template.InformationAdditionnel,
                ListDrugs = template.ListDrugs
                    .Select(drug => new ConduiteOrdonnanceTypeDrugResponse
                    {
                        TherapeuticClass = drug.TherapeuticClass,
                        Category = drug.Category,
                        Medicine = drug.Medicine,
                        Posology = drug.Posology,
                        Duration = drug.Duration,
                    })
                    .ToList(),
            })
            .ToList();

        var customTypes = await db.ConduiteOrdonnanceTypeCatalogItems
            .AsNoTracking()
            .Where(item => item.CabinetIdentityId == cabinetIdentityId)
            .OrderBy(item => item.Label)
            .ThenBy(item => item.CreatedAt)
            .ToListAsync();

        types.AddRange(customTypes.Select((item, index) => MapOrdonnanceTypeCatalogItem(
            item,
            types.Count + index)));

        return types;
    }

    public async Task<ConduiteOrdonnanceTypeCatalogItemResponse> SaveOrdonnanceTypeCatalogItem(
        Guid cabinetIdentityId,
        SaveOrdonnanceTypeCatalogItemRequest request)
    {
        var label = NormalizeOrdonnanceTypeLabel(request.Label);
        if (string.IsNullOrWhiteSpace(label))
        {
            throw new InvalidOperationException("Ordonnance type label is required.");
        }

        var normalizedLabel = NormalizeCatalogLabel(label);
        var typeKey = BuildCustomOrdonnanceTypeKey(label);
        var drugs = SanitizeOrdonnanceTypeDrugs(request.ListDrugs);
        if (drugs.Count == 0)
        {
            throw new InvalidOperationException("At least one medicine is required to save an ordonnance type.");
        }

        var existing = await db.ConduiteOrdonnanceTypeCatalogItems
            .FirstOrDefaultAsync(item =>
                item.CabinetIdentityId == cabinetIdentityId &&
                item.LabelNormalized == normalizedLabel);

        if (existing is null)
        {
            existing = new ConduiteOrdonnanceTypeCatalogItem
            {
                Id = Guid.NewGuid(),
                CabinetIdentityId = cabinetIdentityId,
                TypeKey = typeKey,
                LabelNormalized = normalizedLabel,
            };
            db.ConduiteOrdonnanceTypeCatalogItems.Add(existing);
        }

        existing.Label = label;
        existing.Consigne = NormalizeConsigneForStorage(request.Consigne);
        existing.InformationAdditionnel = NormalizeAdditionalInformation(request.InformationAdditionnel);
        existing.ListDrugs = drugs;

        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException pgEx && pgEx.SqlState == "23505")
        {
            throw new InvalidOperationException("An ordonnance type with this name already exists.");
        }

        return MapOrdonnanceTypeCatalogItem(existing, 0);
    }

    public async Task<List<string>> GetConsigneCatalog(Guid cabinetIdentityId)
    {
        var savedConsignes = await db.ConduiteConsigneCatalogItems
            .AsNoTracking()
            .Where(item => item.CabinetIdentityId == cabinetIdentityId)
            .Select(item => item.Label)
            .ToListAsync();

        var normalizedSeen = new HashSet<string>(StringComparer.Ordinal);
        var catalog = new List<string>();

        foreach (var label in savedConsignes)
        {
            var normalizedLabel = NormalizeConsigneForStorage(label);
            var normalizedKey = NormalizeCatalogLabel(normalizedLabel);
            if (string.IsNullOrWhiteSpace(normalizedKey) || !normalizedSeen.Add(normalizedKey))
            {
                continue;
            }

            catalog.Add(normalizedLabel);
        }

        var payloads = await db.ConsultationConduiteActions
            .AsNoTracking()
            .Where(action => action.ActionKey == ConduiteActionKeys.Ordonnance)
            .Join(
                db.Consultations.AsNoTracking().Where(c => c.CabinetIdentityId == cabinetIdentityId),
                action => action.ConsultationId,
                consultation => consultation.Id,
                (action, _) => action.Payload)
            .ToListAsync();

        foreach (var payload in payloads)
        {
            var consigne = NormalizeConsigneForStorage(ReadPayloadString(payload, "consigne"));
            var normalizedKey = NormalizeCatalogLabel(consigne);

            if (string.IsNullOrWhiteSpace(normalizedKey) || !normalizedSeen.Add(normalizedKey))
            {
                continue;
            }

            catalog.Add(consigne);
        }

        return catalog
            .OrderBy(item => item, StringComparer.CurrentCultureIgnoreCase)
            .ToList();
    }

    public async Task<ConsultationConduiteResponse> GetConsultationConduite(Guid consultationId, Guid cabinetIdentityId)
    {
        var consultationInfo = await db.Consultations
            .AsNoTracking()
            .Where(c => c.Id == consultationId && c.CabinetIdentityId == cabinetIdentityId)
            .Select(c => new { c.ConduiteAdditionalInformation })
            .FirstOrDefaultAsync();

        if (consultationInfo is null)
        {
            throw new InvalidOperationException("Consultation not found.");
        }

        var actions = await db.ConsultationConduiteActions
            .AsNoTracking()
            .Where(item => item.ConsultationId == consultationId)
            .OrderBy(item => item.SortOrder)
            .ThenBy(item => item.CreatedAt)
            .ToListAsync();

        return MapToResponse(consultationId, consultationInfo.ConduiteAdditionalInformation ?? string.Empty, actions);
    }

    public async Task<ConsultationConduiteActionResponse?> GetLatestPreviousOrdonnance(
        Guid consultationId,
        Guid cabinetIdentityId)
    {
        var consultation = await db.Consultations
            .AsNoTracking()
            .Where(c => c.Id == consultationId && c.CabinetIdentityId == cabinetIdentityId)
            .Select(c => new
            {
                c.PatientId,
                c.ConsultationDate,
            })
            .FirstOrDefaultAsync();

        if (consultation is null)
        {
            throw new InvalidOperationException("Consultation not found.");
        }

        var action = await db.ConsultationConduiteActions
            .AsNoTracking()
            .Where(item => item.ActionKey == ConduiteActionKeys.Ordonnance)
            .Join(
                db.Consultations
                    .AsNoTracking()
                    .Where(c =>
                        c.CabinetIdentityId == cabinetIdentityId &&
                        c.PatientId == consultation.PatientId &&
                        c.Id != consultationId &&
                        c.ConsultationDate < consultation.ConsultationDate),
                action => action.ConsultationId,
                previousConsultation => previousConsultation.Id,
                (action, previousConsultation) => new
                {
                    Action = action,
                    previousConsultation.ConsultationDate,
                })
            .OrderByDescending(item => item.ConsultationDate)
            .ThenByDescending(item => item.Action.CreatedAt)
            .Select(item => item.Action)
            .FirstOrDefaultAsync();

        if (action is null)
        {
            return null;
        }

        return new ConsultationConduiteActionResponse
        {
            Id = action.Id,
            ActionKey = action.ActionKey,
            SortOrder = 0,
            Payload = ClonePayload(action.Payload),
        };
    }

    public async Task<ConsultationConduiteResponse> UpsertConsultationConduite(
        Guid consultationId,
        UpsertConsultationConduiteRequest request,
        Guid cabinetIdentityId)
    {
        var consultation = await db.Consultations
            .FirstOrDefaultAsync(c => c.Id == consultationId && c.CabinetIdentityId == cabinetIdentityId);

        if (consultation is null)
        {
            throw new InvalidOperationException("Consultation not found.");
        }

        var sanitizedActions = SanitizeActions(request.Actions);
        consultation.ConduiteAdditionalInformation = NormalizeAdditionalInformation(request.AdditionalInformation);

        await db.ConsultationConduiteActions
            .Where(item => item.ConsultationId == consultationId)
            .ExecuteDeleteAsync();

        if (sanitizedActions.Count > 0)
        {
            db.ConsultationConduiteActions.AddRange(sanitizedActions.Select(item => new ConsultationConduiteAction
            {
                Id = Guid.NewGuid(),
                ConsultationId = consultationId,
                ActionKey = item.ActionKey,
                SortOrder = item.SortOrder,
                Payload = ClonePayload(item.Payload),
            }));
        }

        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException pgEx && pgEx.SqlState == "23505")
        {
            throw new InvalidOperationException("Duplicate conduite action is not allowed for a consultation.");
        }

        await SaveOrdonnanceConsigneCatalogEntries(cabinetIdentityId, sanitizedActions);

        return await GetConsultationConduite(consultationId, cabinetIdentityId);
    }

    private async Task EnsureConsultationOwnership(Guid consultationId, Guid cabinetIdentityId)
    {
        var exists = await db.Consultations
            .AsNoTracking()
            .AnyAsync(c => c.Id == consultationId && c.CabinetIdentityId == cabinetIdentityId);

        if (!exists)
        {
            throw new InvalidOperationException("Consultation not found.");
        }
    }

    private static List<NormalizedConduiteAction> SanitizeActions(
        List<UpsertConsultationConduiteActionRequest>? actions)
    {
        if (actions is null || actions.Count == 0)
        {
            return [];
        }

        var ordered = actions
            .Where(item => item is not null)
            .OrderBy(item => item.SortOrder)
            .ToList();

        var seenKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var result = new List<NormalizedConduiteAction>();

        foreach (var item in ordered)
        {
            var normalizedActionKey = ConduiteActionKeys.NormalizeActionKey(item.ActionKey);
            if (string.IsNullOrWhiteSpace(normalizedActionKey))
            {
                continue;
            }

            if (normalizedActionKey.Contains("orthoptique", StringComparison.Ordinal))
            {
                throw new InvalidOperationException("Bilan orthoptique is not allowed.");
            }

            if (normalizedActionKey == "paraclinique")
            {
                throw new InvalidOperationException(
                    "Paraclinique must be one of: chirurgie, laser, imagerie or bilan sanguin.");
            }

            if (!ConduiteActionKeys.AllowedActionKeys.Contains(normalizedActionKey))
            {
                throw new InvalidOperationException($"Unsupported conduite action '{item.ActionKey}'.");
            }

            if (!seenKeys.Add(normalizedActionKey))
            {
                throw new InvalidOperationException($"Duplicate conduite action '{item.ActionKey}'.");
            }

            result.Add(new NormalizedConduiteAction
            {
                ActionKey = normalizedActionKey,
                SortOrder = result.Count,
                Payload = ClonePayload(item.Payload),
            });
        }

        var chirurgieCount = result.Count(item =>
            string.Equals(item.ActionKey, ConduiteActionKeys.ParacliniqueChirurgie, StringComparison.OrdinalIgnoreCase));

        if (chirurgieCount > 1)
        {
            throw new InvalidOperationException("Only one chirurgie action is allowed per consultation.");
        }

        return result;
    }

    private static ConsultationConduiteResponse MapToResponse(
        Guid consultationId,
        string additionalInformation,
        IEnumerable<ConsultationConduiteAction> actions)
    {
        return new ConsultationConduiteResponse
        {
            ConsultationId = consultationId,
            AdditionalInformation = additionalInformation,
            Actions = actions
                .OrderBy(item => item.SortOrder)
                .ThenBy(item => item.CreatedAt)
                .Select((item, index) => new ConsultationConduiteActionResponse
                {
                    Id = item.Id,
                    ActionKey = item.ActionKey,
                    SortOrder = index,
                    Payload = ClonePayload(item.Payload),
                })
                .ToList(),
        };
    }

    private static ConduiteOrdonnanceTypeCatalogItemResponse MapOrdonnanceTypeCatalogItem(
        ConduiteOrdonnanceTypeCatalogItem item,
        int sortOrder)
    {
        return new ConduiteOrdonnanceTypeCatalogItemResponse
        {
            TypeKey = item.TypeKey,
            Label = item.Label,
            TranslationKey = string.Empty,
            SortOrder = sortOrder,
            Consigne = item.Consigne,
            InformationAdditionnel = item.InformationAdditionnel,
            ListDrugs = item.ListDrugs
                .Select(drug => new ConduiteOrdonnanceTypeDrugResponse
                {
                    TherapeuticClass = drug.TherapeuticClass,
                    Category = drug.Category,
                    Medicine = drug.Medicine,
                    Posology = drug.Posology,
                    Duration = drug.Duration,
                })
                .ToList(),
        };
    }

    private static List<ConduiteOrdonnanceTypeDrugCatalogItem> SanitizeOrdonnanceTypeDrugs(
        List<SaveOrdonnanceTypeDrugRequest>? drugs)
    {
        if (drugs is null || drugs.Count == 0)
        {
            return [];
        }

        return drugs
            .Select(item => new ConduiteOrdonnanceTypeDrugCatalogItem
            {
                TherapeuticClass = NormalizeShortText(item.TherapeuticClass, 120),
                Category = NormalizeShortText(item.Category, 120),
                Medicine = NormalizeShortText(item.Medicine, 180),
                Posology = NormalizeShortText(item.Posology, 400),
                Duration = NormalizeShortText(item.Duration, 80),
            })
            .Where(item =>
                !string.IsNullOrWhiteSpace(item.TherapeuticClass) ||
                !string.IsNullOrWhiteSpace(item.Category) ||
                !string.IsNullOrWhiteSpace(item.Medicine) ||
                !string.IsNullOrWhiteSpace(item.Posology) ||
                !string.IsNullOrWhiteSpace(item.Duration))
            .ToList();
    }

    private static string NormalizeOrdonnanceTypeLabel(string? value)
    {
        return NormalizeShortText(value, 180);
    }

    private static string NormalizeShortText(string? value, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        var compact = string.Join(' ', value.Trim().Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        return compact.Length <= maxLength
            ? compact
            : compact[..maxLength].TrimEnd();
    }

    private static string BuildCustomOrdonnanceTypeKey(string label)
    {
        var normalized = label.Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder("custom_");

        foreach (var character in normalized)
        {
            var category = CharUnicodeInfo.GetUnicodeCategory(character);
            if (category == UnicodeCategory.NonSpacingMark)
            {
                continue;
            }

            if (char.IsLetterOrDigit(character))
            {
                builder.Append(char.ToLowerInvariant(character));
                continue;
            }

            if (builder[^1] != '_')
            {
                builder.Append('_');
            }
        }

        var result = builder.ToString().Trim('_');
        return result.Length <= 140 ? result : result[..140].TrimEnd('_');
    }

    private static string NormalizeAdditionalInformation(string? value)
    {
        return string.IsNullOrWhiteSpace(value)
            ? string.Empty
            : value.Trim();
    }

    private static Dictionary<string, JsonElement> ClonePayload(Dictionary<string, JsonElement>? payload)
    {
        if (payload is null || payload.Count == 0)
        {
            return [];
        }

        var clone = new Dictionary<string, JsonElement>(payload.Count, StringComparer.Ordinal);

        foreach (var item in payload)
        {
            if (item.Value.ValueKind == JsonValueKind.Undefined)
            {
                clone[item.Key] = JsonDocument.Parse("null").RootElement.Clone();
                continue;
            }

            using var doc = JsonDocument.Parse(item.Value.GetRawText());
            clone[item.Key] = doc.RootElement.Clone();
        }

        return clone;
    }

    private static string ReadPayloadString(Dictionary<string, JsonElement> payload, string key)
    {
        if (!payload.TryGetValue(key, out var value))
        {
            return string.Empty;
        }

        var raw = value.ValueKind switch
        {
            JsonValueKind.String => value.GetString(),
            JsonValueKind.Number => value.ToString(),
            JsonValueKind.True => "true",
            JsonValueKind.False => "false",
            _ => string.Empty,
        };

        return raw?.Trim() ?? string.Empty;
    }

    private async Task SaveOrdonnanceConsigneCatalogEntries(
        Guid cabinetIdentityId,
        IReadOnlyList<NormalizedConduiteAction> actions)
    {
        var consignes = ExtractOrdonnanceConsignes(actions);
        if (consignes.Count == 0)
        {
            return;
        }

        var requestedNormalized = consignes
            .Select(NormalizeCatalogLabel)
            .Where(item => !string.IsNullOrWhiteSpace(item))
            .ToHashSet(StringComparer.Ordinal);

        var existingNormalized = await db.ConduiteConsigneCatalogItems
            .AsNoTracking()
            .Where(item =>
                item.CabinetIdentityId == cabinetIdentityId &&
                requestedNormalized.Contains(item.LabelNormalized))
            .Select(item => item.LabelNormalized)
            .ToListAsync();

        var existingSet = existingNormalized.ToHashSet(StringComparer.Ordinal);
        var hasNewItem = false;

        foreach (var consigne in consignes)
        {
            var normalized = NormalizeCatalogLabel(consigne);
            if (string.IsNullOrWhiteSpace(normalized) || !existingSet.Add(normalized))
            {
                continue;
            }

            hasNewItem = true;
            db.ConduiteConsigneCatalogItems.Add(new ConduiteConsigneCatalogItem
            {
                Id = Guid.NewGuid(),
                CabinetIdentityId = cabinetIdentityId,
                Label = consigne,
                LabelNormalized = normalized,
            });
        }

        if (!hasNewItem)
        {
            return;
        }

        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException pgEx && pgEx.SqlState == "23505")
        {
            foreach (var entry in db.ChangeTracker.Entries<ConduiteConsigneCatalogItem>())
            {
                if (entry.State == EntityState.Added)
                {
                    entry.State = EntityState.Detached;
                }
            }
        }
    }

    private static List<string> ExtractOrdonnanceConsignes(IReadOnlyList<NormalizedConduiteAction> actions)
    {
        var seen = new HashSet<string>(StringComparer.Ordinal);
        var values = new List<string>();

        foreach (var action in actions)
        {
            if (!string.Equals(action.ActionKey, ConduiteActionKeys.Ordonnance, StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            var consigne = NormalizeConsigneForStorage(ReadPayloadString(action.Payload, "consigne"));
            var normalized = NormalizeCatalogLabel(consigne);

            if (string.IsNullOrWhiteSpace(normalized) || !seen.Add(normalized))
            {
                continue;
            }

            values.Add(consigne);
        }

        return values;
    }

    private static string NormalizeCatalogLabel(string label)
    {
        return string.Join(' ', label.Trim().Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries))
            .ToLowerInvariant();
    }

    private static string NormalizeConsigneForStorage(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        var compact = string.Join(' ', value.Trim().Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        if (compact.Length <= 500)
        {
            return compact;
        }

        return compact[..500].TrimEnd();
    }

    private sealed class NormalizedConduiteAction
    {
        public string ActionKey { get; set; } = string.Empty;
        public int SortOrder { get; set; }
        public Dictionary<string, JsonElement> Payload { get; set; } = [];
    }
}
