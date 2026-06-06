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
        payload["bodyMap"] = JsonSerializer.SerializeToElement(new
        {
            gender = "male",
            zones = new Dictionary<string, object>(),
            notes = string.Empty,
        });
        return payload;
    }

    private static Dictionary<string, JsonElement> NormalizePayload(Dictionary<string, JsonElement>? payload)
    {
        var defaults = BuildDefaultPayload();
        if (payload is null || payload.Count == 0)
        {
            return defaults;
        }

        var result = new Dictionary<string, JsonElement>(StringComparer.Ordinal);
        var incomingBodyMap = ReadObjectElement(payload, "bodyMap");
        var normalizedBodyMap = new Dictionary<string, object?>(StringComparer.Ordinal)
        {
            ["gender"] = NormalizeGender(ReadStringProperty(incomingBodyMap, "gender")),
            ["zones"] = NormalizeZones(ReadObjectProperty(incomingBodyMap, "zones")),
            ["notes"] = NormalizeText(ReadStringProperty(incomingBodyMap, "notes"), 4000),
        };

        result["bodyMap"] = JsonSerializer.SerializeToElement(normalizedBodyMap);
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

    private static JsonElement ReadObjectProperty(JsonElement source, string key)
    {
        if (source.ValueKind == JsonValueKind.Object
            && source.TryGetProperty(key, out var value)
            && value.ValueKind == JsonValueKind.Object)
        {
            return value;
        }

        return JsonSerializer.SerializeToElement(new Dictionary<string, object?>());
    }

    private static string ReadStringProperty(JsonElement source, string key)
    {
        if (source.ValueKind == JsonValueKind.Object
            && source.TryGetProperty(key, out var value)
            && value.ValueKind == JsonValueKind.String)
        {
            return value.GetString() ?? string.Empty;
        }

        return string.Empty;
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

    private static Dictionary<string, object> NormalizeZones(JsonElement zonesElement)
    {
        var normalized = new Dictionary<string, object>(StringComparer.Ordinal);
        if (zonesElement.ValueKind != JsonValueKind.Object)
        {
            return normalized;
        }

        foreach (var entry in zonesElement.EnumerateObject())
        {
            if (entry.Value.ValueKind != JsonValueKind.Object)
            {
                continue;
            }

            var zone = entry.Value;
            var regionId = NormalizeText(ReadStringProperty(zone, "regionId"), 120);
            if (string.IsNullOrWhiteSpace(regionId))
            {
                regionId = NormalizeText(entry.Name, 120);
            }

            if (string.IsNullOrWhiteSpace(regionId))
            {
                continue;
            }

            normalized[regionId] = new Dictionary<string, object?>
            {
                ["regionId"] = regionId,
                ["label"] = NormalizeText(ReadStringProperty(zone, "label"), 160),
                ["slug"] = NormalizeText(ReadStringProperty(zone, "slug"), 80),
                ["segment"] = NormalizeSegment(ReadStringProperty(zone, "segment")),
                ["pathIndex"] = ReadIntProperty(zone, "pathIndex"),
                ["view"] = NormalizeView(ReadStringProperty(zone, "view")),
                ["description"] = NormalizeText(ReadStringProperty(zone, "description"), 4000),
                ["image"] = NormalizeImage(ReadObjectProperty(zone, "image")),
                ["drawing"] = NormalizeDrawing(ReadObjectProperty(zone, "drawing")),
                ["updatedAt"] = NormalizeNullableText(ReadStringProperty(zone, "updatedAt"), 64),
            };
        }

        return normalized;
    }

    private static object? NormalizeDrawing(JsonElement drawingElement)
    {
        if (drawingElement.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        var lesions = new List<Dictionary<string, object?>>();
        if (drawingElement.TryGetProperty("lesions", out var lesionsElement)
            && lesionsElement.ValueKind == JsonValueKind.Array)
        {
            foreach (var lesionElement in lesionsElement.EnumerateArray())
            {
                if (lesionElement.ValueKind != JsonValueKind.Object)
                {
                    continue;
                }

                var path = NormalizeText(ReadStringProperty(lesionElement, "path"), 8000);
                if (string.IsNullOrWhiteSpace(path))
                {
                    continue;
                }

                var lesionId = NormalizeText(ReadStringProperty(lesionElement, "id"), 80);
                if (string.IsNullOrWhiteSpace(lesionId))
                {
                    lesionId = $"lesion-{lesions.Count + 1}";
                }

                lesions.Add(new Dictionary<string, object?>
                {
                    ["id"] = lesionId,
                    ["path"] = path,
                    ["description"] = NormalizeText(ReadStringProperty(lesionElement, "description"), 4000),
                    ["image"] = NormalizeImage(ReadObjectProperty(lesionElement, "image")),
                });

                if (lesions.Count >= 24)
                {
                    break;
                }
            }
        }

        if (lesions.Count == 0
            && drawingElement.TryGetProperty("paths", out var pathsElement)
            && pathsElement.ValueKind == JsonValueKind.Array)
        {
            foreach (var pathElement in pathsElement.EnumerateArray())
            {
                if (pathElement.ValueKind != JsonValueKind.String)
                {
                    continue;
                }

                var path = NormalizeText(pathElement.GetString(), 8000);
                if (!string.IsNullOrWhiteSpace(path))
                {
                    lesions.Add(new Dictionary<string, object?>
                    {
                        ["id"] = $"legacy-lesion-{lesions.Count + 1}",
                        ["path"] = path,
                        ["description"] = string.Empty,
                        ["image"] = null,
                    });
                }

                if (lesions.Count >= 24)
                {
                    break;
                }
            }
        }

        if (lesions.Count == 0)
        {
            return null;
        }

        return new Dictionary<string, object?>
        {
            ["viewBox"] = NormalizeText(ReadStringProperty(drawingElement, "viewBox"), 80) is { Length: > 0 } viewBox
                ? viewBox
                : "0 0 200 260",
            ["lesions"] = lesions,
        };
    }

    private static object? NormalizeImage(JsonElement imageElement)
    {
        if (imageElement.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        var documentId = NormalizeNullableText(ReadStringProperty(imageElement, "documentId"), 64);
        var fileUrl = NormalizeNullableText(ReadStringProperty(imageElement, "fileUrl"), 500);
        var originalFileName = NormalizeNullableText(ReadStringProperty(imageElement, "originalFileName"), 260);
        var contentType = NormalizeNullableText(ReadStringProperty(imageElement, "contentType"), 120);
        var createdAt = NormalizeNullableText(ReadStringProperty(imageElement, "createdAt"), 64);
        var fileSizeBytes = ReadLongProperty(imageElement, "fileSizeBytes");

        if (string.IsNullOrWhiteSpace(documentId) && string.IsNullOrWhiteSpace(fileUrl))
        {
            return null;
        }

        return new Dictionary<string, object?>
        {
            ["documentId"] = documentId ?? string.Empty,
            ["fileUrl"] = fileUrl ?? string.Empty,
            ["originalFileName"] = originalFileName ?? string.Empty,
            ["contentType"] = contentType ?? string.Empty,
            ["fileSizeBytes"] = fileSizeBytes,
            ["createdAt"] = createdAt ?? string.Empty,
        };
    }

    private static int ReadIntProperty(JsonElement source, string key)
    {
        if (source.ValueKind == JsonValueKind.Object
            && source.TryGetProperty(key, out var value)
            && value.TryGetInt32(out var parsed))
        {
            return parsed;
        }

        return 0;
    }

    private static long ReadLongProperty(JsonElement source, string key)
    {
        if (source.ValueKind == JsonValueKind.Object
            && source.TryGetProperty(key, out var value)
            && value.TryGetInt64(out var parsed))
        {
            return parsed;
        }

        return 0;
    }

    private static string NormalizeGender(string? value)
    {
        var normalized = (value ?? string.Empty).Trim().ToLowerInvariant();
        if (normalized.Contains("femme", StringComparison.Ordinal)
            || normalized.Contains("female", StringComparison.Ordinal))
        {
            return "female";
        }

        return "male";
    }

    private static string NormalizeView(string? value)
    {
        var normalized = (value ?? string.Empty).Trim().ToLowerInvariant();
        return normalized == "back" ? "back" : "front";
    }

    private static string NormalizeSegment(string? value)
    {
        var normalized = (value ?? string.Empty).Trim().ToLowerInvariant();
        return normalized switch
        {
            "left" => "left",
            "right" => "right",
            _ => "common",
        };
    }

    private static string NormalizeText(string? value, int maxLength)
    {
        var normalized = string.Join(
            ' ',
            (value ?? string.Empty)
                .Trim()
                .Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));

        if (normalized.Length <= maxLength)
        {
            return normalized;
        }

        return normalized[..maxLength].TrimEnd();
    }

    private static string? NormalizeNullableText(string? value, int maxLength)
    {
        var normalized = NormalizeText(value, maxLength);
        return string.IsNullOrWhiteSpace(normalized) ? null : normalized;
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
