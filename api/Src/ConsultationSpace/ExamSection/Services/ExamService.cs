using System.Text.Json;
using api.Src.ConsultationSpace.ExamSection.Dtos.Requests;
using api.Src.ConsultationSpace.ExamSection.Dtos.Responses;
using api.Src.ConsultationSpace.ExamSection.Entities;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace api.Src.ConsultationSpace.ExamSection.Services;

public class ExamService(AppDbContext db) : IExamService
{
    private static readonly IReadOnlyDictionary<string, IReadOnlyList<string>> DefaultCatalog =
        new Dictionary<string, IReadOnlyList<string>>(StringComparer.OrdinalIgnoreCase)
        {
            ["orlCouConjonctive"] =
            [
                "Conjonctives pâles",
                "Conjonctives hyperémiées",
                "Amygdales inflammatoires",
                "Adénopathie cervicale",
                "Otalgie"
            ],
            ["auscultationCardiaque"] =
            [
                "Souffle cardiaque",
                "Rythme irrégulier",
                "Tachycardie",
                "Bradycardie",
                "Bruits du cœur assourdis"
            ],
            ["auscultationPulmonaire"] =
            [
                "Râles crépitants",
                "Sibilants",
                "Ronchis",
                "Murmure vésiculaire diminué",
                "Allongement expiratoire"
            ],
            ["abdomen"] =
            [
                "Douleur à la palpation",
                "Défense abdominale",
                "Hépatomégalie",
                "Splénomégalie",
                "Ascite"
            ],
            ["neurologique"] =
            [
                "Déficit moteur focal",
                "Trouble sensitif",
                "Trouble de la marche",
                "Raideur nucale",
                "Trouble de la conscience"
            ],
            ["locomoteurOsteoArticulaire"] =
            [
                "Douleur articulaire",
                "Limitation articulaire",
                "Tuméfaction articulaire",
                "Lombalgie",
                "Raideur matinale"
            ],
            ["peauDermatologique"] =
            [
                "Éruption érythémateuse",
                "Lésion ulcérée",
                "Prurit",
                "Pâleur cutanée",
                "Ecchymoses"
            ],
            ["urogenital"] =
            [
                "Brûlures mictionnelles",
                "Douleur lombaire",
                "Hématurie",
                "Écoulement génital",
                "Pollakiurie"
            ],
        };

    public async Task<ConsultationExamResponse> GetConsultationExam(Guid consultationId, Guid cabinetIdentityId)
    {
        var consultationExists = await db.Consultations
            .AsNoTracking()
            .AnyAsync(c => c.Id == consultationId && c.CabinetIdentityId == cabinetIdentityId);

        if (!consultationExists)
        {
            throw new InvalidOperationException("Consultation not found.");
        }

        var exam = await db.ConsultationExams
            .FirstOrDefaultAsync(e => e.ConsultationId == consultationId);

        Dictionary<string, JsonElement> clonedPayload;
        if (exam is null)
        {
            clonedPayload = BuildDefaultPayload();
            db.ConsultationExams.Add(new ConsultationExam
            {
                ConsultationId = consultationId,
                Payload = ClonePayload(clonedPayload),
            });
            await db.SaveChangesAsync();
        }
        else
        {
            clonedPayload = NormalizePayload(exam.Payload);
            if (!PayloadEquals(exam.Payload, clonedPayload))
            {
                exam.Payload = ClonePayload(clonedPayload);
                await db.SaveChangesAsync();
            }
        }

        return new ConsultationExamResponse
        {
            ConsultationId = consultationId,
            Payload = clonedPayload,
        };
    }

    public async Task<ConsultationExamResponse> UpsertConsultationExam(
        Guid consultationId,
        UpsertConsultationExamRequest request,
        Guid cabinetIdentityId)
    {
        var consultation = await db.Consultations
            .FirstOrDefaultAsync(c => c.Id == consultationId && c.CabinetIdentityId == cabinetIdentityId)
            ?? throw new InvalidOperationException("Consultation not found.");

        var payload = request.Payload is null || request.Payload.Count == 0
            ? BuildDefaultPayload()
            : NormalizePayload(request.Payload);

        var exam = await db.ConsultationExams.FirstOrDefaultAsync(e => e.ConsultationId == consultationId);
        if (exam is null)
        {
            exam = new ConsultationExam
            {
                ConsultationId = consultationId,
                Payload = payload,
            };
            db.ConsultationExams.Add(exam);
        }
        else
        {
            exam.Payload = payload;
        }

        await db.SaveChangesAsync();

        return new ConsultationExamResponse
        {
            ConsultationId = consultationId,
            Payload = ClonePayload(payload),
        };
    }

    public async Task<List<ExamFindingCatalogItemResponse>> GetFindingCatalog(Guid cabinetIdentityId, string? section)
    {
        var normalizedSection = NormalizeSection(section);

        var customItems = await db.ExamFindingCatalogItems
            .AsNoTracking()
            .Where(item =>
                item.CabinetIdentityId == cabinetIdentityId &&
                (normalizedSection == null || item.SectionNormalized == normalizedSection))
            .Select(item => new ExamFindingCatalogItemResponse
            {
                Section = item.Section,
                IsCustom = true,
                Label = item.Label,
            })
            .ToListAsync();

        var catalog = new List<ExamFindingCatalogItemResponse>();
        var byKey = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var entry in DefaultCatalog)
        {
            if (normalizedSection is not null && !string.Equals(entry.Key, normalizedSection, StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            foreach (var label in entry.Value)
            {
                var key = BuildCatalogKey(entry.Key, label);
                if (!byKey.Add(key))
                {
                    continue;
                }

                catalog.Add(new ExamFindingCatalogItemResponse
                {
                    Section = entry.Key,
                    IsCustom = false,
                    Label = label,
                });
            }
        }

        foreach (var item in customItems)
        {
            var key = BuildCatalogKey(item.Section, item.Label);
            if (!byKey.Add(key))
            {
                continue;
            }

            catalog.Add(item);
        }

        return catalog
            .OrderBy(item => item.Section)
            .ThenBy(item => item.Label)
            .ToList();
    }

    public async Task<ExamFindingCatalogItemResponse> AddFindingCatalogItem(
        Guid cabinetIdentityId,
        UpsertExamFindingCatalogItemRequest request)
    {
        var normalizedSection = NormalizeSection(request.Section)
            ?? throw new InvalidOperationException("Section is required.");

        var label = NormalizeLabelForStorage(request.Label);
        if (string.IsNullOrWhiteSpace(label))
        {
            throw new InvalidOperationException("Label is required.");
        }

        var normalizedLabel = NormalizeCatalogLabel(label);

        var existing = await db.ExamFindingCatalogItems
            .FirstOrDefaultAsync(item =>
                item.CabinetIdentityId == cabinetIdentityId &&
                item.SectionNormalized == normalizedSection &&
                item.LabelNormalized == normalizedLabel);

        if (existing is not null)
        {
            return new ExamFindingCatalogItemResponse
            {
                Section = existing.Section,
                IsCustom = true,
                Label = existing.Label,
            };
        }

        var itemToInsert = new ExamFindingCatalogItem
        {
            Id = Guid.NewGuid(),
            CabinetIdentityId = cabinetIdentityId,
            Section = normalizedSection,
            SectionNormalized = normalizedSection,
            Label = label,
            LabelNormalized = normalizedLabel,
        };

        db.ExamFindingCatalogItems.Add(itemToInsert);

        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException pgEx && pgEx.SqlState == "23505")
        {
            var raceWinner = await db.ExamFindingCatalogItems
                .AsNoTracking()
                .FirstAsync(item =>
                    item.CabinetIdentityId == cabinetIdentityId &&
                    item.SectionNormalized == normalizedSection &&
                    item.LabelNormalized == normalizedLabel);

            return new ExamFindingCatalogItemResponse
            {
                Section = raceWinner.Section,
                IsCustom = true,
                Label = raceWinner.Label,
            };
        }

        return new ExamFindingCatalogItemResponse
        {
            Section = itemToInsert.Section,
            IsCustom = true,
            Label = itemToInsert.Label,
        };
    }

    private static Dictionary<string, JsonElement> BuildDefaultPayload()
    {
        var payload = new Dictionary<string, JsonElement>(StringComparer.Ordinal);

        payload["general"] = JsonSerializer.SerializeToElement(new
        {
            etatGeneral = string.Empty,
            tensionSystolique = 10,
            tensionDiastolique = 10,
            frequenceCardiaque = (int?)null,
            rythmeCardiaque = string.Empty,
            temperature = 37m,
            saturationO2 = 90,
            poidsKg = (decimal?)null,
            tailleCm = (decimal?)null,
            imc = (decimal?)null,
        });

        var specific = new Dictionary<string, object>(StringComparer.Ordinal);
        foreach (var section in DefaultCatalog.Keys)
        {
            specific[section] = new
            {
                status = "not_examined",
                selectedFindings = Array.Empty<string>(),
                findingDetails = new Dictionary<string, object>(),
                notes = string.Empty,
            };
        }

        payload["specific"] = JsonSerializer.SerializeToElement(specific);
        return payload;
    }

    private static Dictionary<string, JsonElement> NormalizePayload(Dictionary<string, JsonElement>? payload)
    {
        var defaults = BuildDefaultPayload();
        if (payload is null || payload.Count == 0)
        {
            return defaults;
        }

        var result = ClonePayload(payload);
        var incomingGeneral = ReadObjectElement(payload, "general");
        var defaultGeneral = ReadObjectElement(defaults, "general");

        var normalizedGeneral = new Dictionary<string, object?>(StringComparer.Ordinal);
        foreach (var defaultEntry in defaultGeneral.EnumerateObject())
        {
            if (incomingGeneral.ValueKind == JsonValueKind.Object
                && incomingGeneral.TryGetProperty(defaultEntry.Name, out var incomingValue)
                && incomingValue.ValueKind != JsonValueKind.Null
                && incomingValue.ValueKind != JsonValueKind.Undefined)
            {
                normalizedGeneral[defaultEntry.Name] = incomingValue;
                continue;
            }

            normalizedGeneral[defaultEntry.Name] = defaultEntry.Value;
        }

        result["general"] = JsonSerializer.SerializeToElement(normalizedGeneral);

        if (!result.TryGetValue("specific", out var specificEl)
            || specificEl.ValueKind == JsonValueKind.Null
            || specificEl.ValueKind == JsonValueKind.Undefined)
        {
            result["specific"] = defaults["specific"].Clone();
        }

        return result;
    }

    private static JsonElement ReadObjectElement(Dictionary<string, JsonElement> payload, string key)
    {
        if (payload.TryGetValue(key, out var value) && value.ValueKind == JsonValueKind.Object)
        {
            return value;
        }

        return JsonSerializer.SerializeToElement(new Dictionary<string, object?>());
    }

    private static bool PayloadEquals(Dictionary<string, JsonElement> left, Dictionary<string, JsonElement> right)
    {
        return JsonSerializer.Serialize(left) == JsonSerializer.Serialize(right);
    }

    private static Dictionary<string, JsonElement> ClonePayload(Dictionary<string, JsonElement>? payload)
    {
        var result = new Dictionary<string, JsonElement>(StringComparer.Ordinal);
        if (payload is null)
        {
            return result;
        }

        foreach (var entry in payload)
        {
            result[entry.Key] = entry.Value.ValueKind == JsonValueKind.Undefined
                ? JsonDocument.Parse("null").RootElement.Clone()
                : entry.Value.Clone();
        }

        return result;
    }

    private static string? NormalizeSection(string? section)
    {
        if (string.IsNullOrWhiteSpace(section))
        {
            return null;
        }

        var normalized = section.Trim();
        if (!DefaultCatalog.ContainsKey(normalized))
        {
            throw new InvalidOperationException($"Unsupported section '{section}'.");
        }

        return normalized;
    }

    private static string BuildCatalogKey(string section, string label)
    {
        return $"{section.ToLowerInvariant()}::{NormalizeCatalogLabel(label)}";
    }

    private static string NormalizeCatalogLabel(string value)
    {
        return string.Join(' ', value.Trim().ToLowerInvariant().Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
    }

    private static string NormalizeLabelForStorage(string value)
    {
        return string.Join(' ', value.Trim().Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
    }
}
