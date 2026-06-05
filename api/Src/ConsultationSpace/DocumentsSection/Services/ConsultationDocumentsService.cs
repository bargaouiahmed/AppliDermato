using api.Src.ConsultationSpace.DocumentsSection.Dtos.Requests;
using api.Src.ConsultationSpace.DocumentsSection.Dtos.Responses;
using api.Src.ConsultationSpace.DocumentsSection.Entities;
using Microsoft.EntityFrameworkCore;

namespace api.Src.ConsultationSpace.DocumentsSection.Services;

public class ConsultationDocumentsService(AppDbContext db) : IConsultationDocumentsService
{
    private static readonly HashSet<string> AllowedFileExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".pdf",
        ".png",
        ".jpg",
        ".jpeg",
        ".webp",
    };

    private const long MaxFileSizeBytes = 10 * 1024 * 1024;
    private const string StorageRootFolder = "exploration-documents";

    public async Task<ConsultationDocumentsResponse> GetConsultationDocuments(Guid consultationId, Guid cabinetIdentityId)
    {
        await EnsureConsultationOwnership(consultationId, cabinetIdentityId);

        var documents = await db.ConsultationExplorationDocuments
            .AsNoTracking()
            .Where(item => item.ConsultationId == consultationId)
            .OrderByDescending(item => item.CreatedAt)
            .ToListAsync();

        return new ConsultationDocumentsResponse
        {
            ConsultationId = consultationId,
            ExplorationDocuments = documents.Select(MapToResponse).ToList(),
        };
    }

    public async Task<ConsultationExplorationDocumentResponse> CreateExplorationDocument(
        Guid consultationId,
        CreateExplorationDocumentRequest request,
        Guid cabinetIdentityId)
    {
        await EnsureConsultationOwnership(consultationId, cabinetIdentityId);

        var file = request.File ?? throw new InvalidOperationException("A file is required.");
        ValidateUploadedFile(file);

        var consultationFolder = Path.Combine(
            Directory.GetCurrentDirectory(),
            "wwwroot",
            StorageRootFolder,
            consultationId.ToString("N"));
        Directory.CreateDirectory(consultationFolder);

        var storedExtension = Path.GetExtension(file.FileName).ToLowerInvariant();
        var storedFileName = $"{DateTime.UtcNow:yyyyMMddHHmmss}_{Guid.NewGuid():N}{storedExtension}";
        var absoluteFilePath = Path.Combine(consultationFolder, storedFileName);

        await using (var stream = new FileStream(absoluteFilePath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        var relativeFilePath = $"/{StorageRootFolder}/{consultationId:N}/{storedFileName}";
        var document = new ConsultationExplorationDocument
        {
            Id = Guid.NewGuid(),
            ConsultationId = consultationId,
            TypeLabels = NormalizeTypeLabels(request.TypeLabels).ToArray(),
            Clinic = NormalizeText(request.Clinic, 160),
            Forfait = NormalizeText(request.Forfait, 160),
            Operator = NormalizeText(request.Operator, 160),
            Precaution = NormalizeText(request.Precaution, 240),
            AdditionalInformation = NormalizeMultilineText(request.AdditionalInformation, 2000),
            OriginalFileName = NormalizeOriginalFileName(file.FileName),
            StoredFileName = storedFileName,
            RelativeFilePath = relativeFilePath,
            ContentType = NormalizeText(file.ContentType, 120),
            FileSizeBytes = file.Length,
        };

        db.ConsultationExplorationDocuments.Add(document);

        try
        {
            await db.SaveChangesAsync();
        }
        catch
        {
            DeleteStoredFile(relativeFilePath);
            throw;
        }

        return MapToResponse(document);
    }

    public async Task DeleteExplorationDocument(Guid consultationId, Guid documentId, Guid cabinetIdentityId)
    {
        await EnsureConsultationOwnership(consultationId, cabinetIdentityId);

        var document = await db.ConsultationExplorationDocuments
            .FirstOrDefaultAsync(item => item.Id == documentId && item.ConsultationId == consultationId)
            ?? throw new InvalidOperationException("Exploration document not found.");

        db.ConsultationExplorationDocuments.Remove(document);
        await db.SaveChangesAsync();

        DeleteStoredFile(document.RelativeFilePath);
    }

    private async Task EnsureConsultationOwnership(Guid consultationId, Guid cabinetIdentityId)
    {
        var exists = await db.Consultations
            .AsNoTracking()
            .AnyAsync(item => item.Id == consultationId && item.CabinetIdentityId == cabinetIdentityId);

        if (!exists)
        {
            throw new InvalidOperationException("Consultation not found.");
        }
    }

    private static ConsultationExplorationDocumentResponse MapToResponse(ConsultationExplorationDocument document)
    {
        return new ConsultationExplorationDocumentResponse
        {
            Id = document.Id,
            ConsultationId = document.ConsultationId,
            TypeLabels = document.TypeLabels.ToList(),
            Clinic = document.Clinic,
            Forfait = document.Forfait,
            Operator = document.Operator,
            Precaution = document.Precaution,
            AdditionalInformation = document.AdditionalInformation,
            OriginalFileName = document.OriginalFileName,
            FileUrl = document.RelativeFilePath,
            ContentType = document.ContentType,
            FileSizeBytes = document.FileSizeBytes,
            CreatedAt = document.CreatedAt,
        };
    }

    private static void ValidateUploadedFile(IFormFile file)
    {
        if (file.Length <= 0)
        {
            throw new InvalidOperationException("The uploaded file is empty.");
        }

        if (file.Length > MaxFileSizeBytes)
        {
            throw new InvalidOperationException("The uploaded file exceeds the 10 MB limit.");
        }

        var extension = Path.GetExtension(file.FileName);
        if (string.IsNullOrWhiteSpace(extension) || !AllowedFileExtensions.Contains(extension))
        {
            throw new InvalidOperationException("Only PDF, PNG, JPG, JPEG, and WEBP files are allowed.");
        }
    }

    private static List<string> NormalizeTypeLabels(IEnumerable<string>? values)
    {
        if (values is null)
        {
            return [];
        }

        var normalized = new List<string>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var value in values)
        {
            var item = NormalizeText(value, 120);
            if (string.IsNullOrWhiteSpace(item) || !seen.Add(item))
            {
                continue;
            }

            normalized.Add(item);

            if (normalized.Count >= 10)
            {
                break;
            }
        }

        return normalized;
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

    private static string NormalizeMultilineText(string? value, int maxLength)
    {
        var normalized = (value ?? string.Empty)
            .Replace("\r\n", "\n")
            .Trim();

        if (normalized.Length <= maxLength)
        {
            return normalized;
        }

        return normalized[..maxLength].TrimEnd();
    }

    private static string NormalizeOriginalFileName(string? fileName)
    {
        var normalized = Path.GetFileName(fileName ?? string.Empty).Trim();
        if (normalized.Length <= 260)
        {
            return normalized;
        }

        return normalized[..260].TrimEnd();
    }

    private static void DeleteStoredFile(string relativeFilePath)
    {
        if (string.IsNullOrWhiteSpace(relativeFilePath))
        {
            return;
        }

        var relativePath = relativeFilePath.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
        var absolutePath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", relativePath);

        if (File.Exists(absolutePath))
        {
            File.Delete(absolutePath);
        }

        var parentFolder = Path.GetDirectoryName(absolutePath);
        if (!string.IsNullOrWhiteSpace(parentFolder) &&
            Directory.Exists(parentFolder) &&
            !Directory.EnumerateFileSystemEntries(parentFolder).Any())
        {
            Directory.Delete(parentFolder);
        }
    }
}
