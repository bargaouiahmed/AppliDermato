using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using api.Src.Auth.Entities;
using api.Src.Auth.Helpers;
using api.Src.Configuration;
using api.Src.Smtp.Services;
using api.Src.TechAssistance.Dtos;
using api.Src.TechAssistance.Entities;
using Microsoft.EntityFrameworkCore;

namespace api.Src.TechAssistance.Services;

public class TechAssistanceService(
    AppDbContext db,
    ISmtpService smtpService,
    PublicUrlSettings publicUrls)
{
    private static readonly HashSet<string> AllowedFileExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".pdf",
        ".png",
        ".jpg",
        ".jpeg",
        ".webp",
        ".txt",
        ".csv",
        ".doc",
        ".docx",
        ".xls",
        ".xlsx",
        ".zip"
    };

    private const int SubjectMaxLength = 180;
    private const int MessageMaxLength = 3000;
    private const int MaxAttachmentsPerMessage = 5;
    private const long MaxFileSizeBytes = 10 * 1024 * 1024;
    private const string StorageRootFolder = "tech-assistance";

    public async Task<List<TechAssistanceTicketResponse>> GetTicketsAsync(ClaimsPrincipal user)
    {
        var cabinetIdentityId = user.GetCabinetIdentityId();
        var role = NormalizeRole(user.GetRoleOrThrow());
        var isAdmin = IsAdminRole(role);

        var query = db.Set<TechAssistanceTicket>().AsQueryable();

        if (!isAdmin)
        {
            query = query.Where(item => item.CabinetIdentityId == cabinetIdentityId);
        }
        else
        {
            var unseen = await db.Set<TechAssistanceTicket>()
                .Where(item => !item.SeenByAdmins)
                .ToListAsync();

            if (unseen.Count > 0)
            {
                var now = DateTime.UtcNow;
                foreach (var item in unseen)
                {
                    item.SeenByAdmins = true;
                    item.SeenByAdminsAt = now;
                }

                await db.SaveChangesAsync();
            }
        }

        var tickets = await query
            .AsNoTracking()
            .Include(item => item.Messages.OrderBy(message => message.CreatedAt))
            .ThenInclude(message => message.Attachments.OrderBy(attachment => attachment.CreatedAt))
            .OrderByDescending(item => item.LastMessageAt ?? item.UpdatedAt)
            .ToListAsync();

        if (!isAdmin)
        {
            var unreadMessages = tickets
                .SelectMany(item => item.Messages)
                .Where(message => !message.ReadByRequester && IsAdminRole(message.SenderRole))
                .Select(message => message.Id)
                .ToArray();

            if (unreadMessages.Length > 0)
            {
                await db.Set<TechAssistanceMessage>()
                    .Where(message => unreadMessages.Contains(message.Id))
                    .ExecuteUpdateAsync(setters => setters
                        .SetProperty(message => message.ReadByRequester, true)
                        .SetProperty(message => message.ReadByRequesterAt, DateTime.UtcNow));

                tickets = await query
                    .AsNoTracking()
                    .Include(item => item.Messages.OrderBy(message => message.CreatedAt))
                    .ThenInclude(message => message.Attachments.OrderBy(attachment => attachment.CreatedAt))
                    .OrderByDescending(item => item.LastMessageAt ?? item.UpdatedAt)
                    .ToListAsync();
            }
        }

        return tickets.Select(ToResponse).ToList();
    }

    public async Task<TechAssistanceTicketResponse> CreateTicketAsync(
        ClaimsPrincipal user,
        CreateTechAssistanceTicketRequest request)
    {
        var cabinetIdentityId = user.GetCabinetIdentityId();
        var role = NormalizeRole(user.GetRoleOrThrow());
        var doctor = await LoadDoctorAsync(cabinetIdentityId);
        var subject = NormalizeRequired(request.Subject, "Subject", SubjectMaxLength);
        var messageText = NormalizeMessageWithOptionalAttachments(request.Message, request.Attachments);
        var now = DateTime.UtcNow;

        var ticket = new TechAssistanceTicket
        {
            Id = Guid.NewGuid(),
            CabinetIdentityId = cabinetIdentityId,
            DoctorId = doctor.Id,
            DoctorFirstName = doctor.Firstname,
            DoctorLastName = doctor.Lastname,
            DoctorEmail = doctor.CabinetIdentity?.Email ?? string.Empty,
            Subject = subject,
            Status = TechAssistanceStatuses.Open,
            SeenByAdmins = IsAdminRole(role),
            SeenByAdminsAt = IsAdminRole(role) ? now : null,
            LastMessageAt = now,
            LastDoctorMessageAt = IsAdminRole(role) ? null : now,
            LastAdminMessageAt = IsAdminRole(role) ? now : null
        };

        var message = BuildMessage(ticket.Id, doctor, role, messageText, readByRequester: IsAdminRole(role));
        message.Attachments = await SaveAttachmentsAsync(ticket.Id, message.Id, request.Attachments);
        ticket.Messages.Add(message);

        db.Set<TechAssistanceTicket>().Add(ticket);
        await SaveChangesAndCleanUpOnFailureAsync(message.Attachments);

        return ToResponse(ticket);
    }

    public async Task<TechAssistanceTicketResponse> AddMessageAsync(
        ClaimsPrincipal user,
        Guid ticketId,
        CreateTechAssistanceMessageRequest request)
    {
        var cabinetIdentityId = user.GetCabinetIdentityId();
        var role = NormalizeRole(user.GetRoleOrThrow());
        var isAdmin = IsAdminRole(role);
        var sender = await LoadDoctorAsync(cabinetIdentityId);
        var messageText = NormalizeMessageWithOptionalAttachments(request.Message, request.Attachments);

        var ticket = await LoadTicketStateAsync(ticketId);
        if (!isAdmin && ticket.CabinetIdentityId != cabinetIdentityId)
        {
            throw new InvalidOperationException("Ticket not found.");
        }

        if (ticket.Status == TechAssistanceStatuses.Closed)
        {
            throw new InvalidOperationException("Closed tickets cannot receive new messages.");
        }

        var now = DateTime.UtcNow;
        var message = BuildMessage(ticket.Id, sender, role, messageText, readByRequester: !isAdmin);
        message.Attachments = await SaveAttachmentsAsync(ticket.Id, message.Id, request.Attachments);

        await using var transaction = await db.Database.BeginTransactionAsync();
        try
        {
            db.Set<TechAssistanceMessage>().Add(message);
            await db.SaveChangesAsync();

            var affectedRows = isAdmin
                ? await db.Set<TechAssistanceTicket>()
                    .Where(item => item.Id == ticket.Id)
                    .ExecuteUpdateAsync(setters => setters
                        .SetProperty(item => item.Status, TechAssistanceStatuses.Answered)
                        .SetProperty(item => item.LastMessageAt, now)
                        .SetProperty(item => item.LastAdminMessageAt, now)
                        .SetProperty(item => item.SeenByAdmins, true)
                        .SetProperty(item => item.SeenByAdminsAt, now)
                        .SetProperty(item => item.UpdatedAt, now))
                : await db.Set<TechAssistanceTicket>()
                    .Where(item => item.Id == ticket.Id)
                    .ExecuteUpdateAsync(setters => setters
                        .SetProperty(item => item.Status, TechAssistanceStatuses.Open)
                        .SetProperty(item => item.LastMessageAt, now)
                        .SetProperty(item => item.LastDoctorMessageAt, now)
                        .SetProperty(item => item.SeenByAdmins, false)
                        .SetProperty(item => item.SeenByAdminsAt, (DateTime?)null)
                        .SetProperty(item => item.UpdatedAt, now));

            if (affectedRows == 0)
            {
                throw new InvalidOperationException("Ticket not found.");
            }

            await transaction.CommitAsync();
        }
        catch
        {
            await transaction.RollbackAsync();
            foreach (var attachment in message.Attachments)
            {
                DeleteStoredFile(attachment.RelativeFilePath);
            }

            throw;
        }

        return await LoadTicketResponseAsync(ticket.Id);
    }

    public async Task<TechAssistanceTicketResponse> CloseTicketAsync(
        ClaimsPrincipal user,
        Guid ticketId)
    {
        var role = NormalizeRole(user.GetRoleOrThrow());
        if (!IsAdminRole(role))
        {
            throw new InvalidOperationException("Only admins can close tech assistance tickets.");
        }

        var now = DateTime.UtcNow;
        var affectedRows = await db.Set<TechAssistanceTicket>()
            .Where(item => item.Id == ticketId)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(item => item.Status, TechAssistanceStatuses.Closed)
                .SetProperty(item => item.SeenByAdmins, true)
                .SetProperty(item => item.SeenByAdminsAt, now)
                .SetProperty(item => item.UpdatedAt, now));

        if (affectedRows == 0)
        {
            throw new InvalidOperationException("Ticket not found.");
        }

        return await LoadTicketResponseAsync(ticketId);
    }

    public async Task<TechAssistanceTicketResponse> NotifyTechLeadAsync(
        ClaimsPrincipal user,
        Guid ticketId)
    {
        var role = NormalizeRole(user.GetRoleOrThrow());
        if (role != "super_admin")
        {
            throw new InvalidOperationException("Only the super admin can notify the tech lead.");
        }

        var ticket = await LoadTicketEntityForResponseAsync(ticketId);
        var techLeadEmail = Environment.GetEnvironmentVariable("tech_lead_email")?.Trim();
        if (string.IsNullOrWhiteSpace(techLeadEmail))
        {
            throw new InvalidOperationException("tech_lead_email environment variable is not set.");
        }

        var reviewUrl = PublicUrlSettingsReader.BuildUrl(
            publicUrls.FrontendUrl,
            $"tech-assistance/review/{ticket.Id:D}");
        var firstMessage = ticket.Messages
            .OrderBy(message => message.CreatedAt)
            .FirstOrDefault();

        await smtpService.SendTechAssistanceEscalationEmailAsync(
            techLeadEmail,
            ticket.Subject,
            BuildDisplayName(ticket.DoctorFirstName, ticket.DoctorLastName),
            ticket.DoctorEmail,
            firstMessage?.Message ?? string.Empty,
            reviewUrl,
            ticket.CreatedAt);

        var now = DateTime.UtcNow;
        var affectedRows = await db.Set<TechAssistanceTicket>()
            .Where(item => item.Id == ticketId)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(item => item.TechLeadNotifiedAt, now)
                .SetProperty(item => item.Status, TechAssistanceStatuses.Escalated)
                .SetProperty(item => item.UpdatedAt, now));

        if (affectedRows == 0)
        {
            throw new InvalidOperationException("Ticket not found.");
        }

        return await LoadTicketResponseAsync(ticketId);
    }

    public async Task<TechAssistanceTicketResponse> GetTicketForTechLeadAsync(
        Guid ticketId,
        TechLeadReviewRequest request)
    {
        EnsureTechLeadPassword(request.Password);

        return await LoadTicketResponseAsync(ticketId);
    }

    public async Task<TechAssistanceUnreadCountResponse> GetUnreadCountAsync(ClaimsPrincipal user)
    {
        var cabinetIdentityId = user.GetCabinetIdentityId();
        var role = NormalizeRole(user.GetRoleOrThrow());

        if (IsAdminRole(role))
        {
            return new TechAssistanceUnreadCountResponse
            {
                Count = await GetAdminUnreadCountAsync()
            };
        }

        return new TechAssistanceUnreadCountResponse
        {
            Count = await GetDoctorUnreadCountAsync(cabinetIdentityId)
        };
    }

    public async Task<int> GetAdminUnreadCountAsync()
        => await db.Set<TechAssistanceTicket>().CountAsync(item => !item.SeenByAdmins);

    public async Task<int> GetDoctorUnreadCountAsync(Guid cabinetIdentityId)
        => await db.Set<TechAssistanceMessage>()
            .CountAsync(message =>
                !message.ReadByRequester &&
                (message.SenderRole == "admin" || message.SenderRole == "super_admin") &&
                message.Ticket != null &&
                message.Ticket.CabinetIdentityId == cabinetIdentityId);

    public static bool IsAdminRole(string? role)
        => NormalizeRole(role) is "admin" or "super_admin";

    private async Task<Doctor> LoadDoctorAsync(Guid cabinetIdentityId)
    {
        return await db.Doctors
            .Include(doctor => doctor.CabinetIdentity)
            .FirstOrDefaultAsync(doctor => doctor.CabinetIdentityId == cabinetIdentityId)
            ?? throw new InvalidOperationException("Doctor profile not found.");
    }

    private async Task<TechAssistanceTicket> LoadTicketEntityForResponseAsync(Guid ticketId)
    {
        return await db.Set<TechAssistanceTicket>()
            .AsNoTracking()
            .Include(item => item.Messages.OrderBy(message => message.CreatedAt))
            .ThenInclude(message => message.Attachments.OrderBy(attachment => attachment.CreatedAt))
            .FirstOrDefaultAsync(item => item.Id == ticketId)
            ?? throw new InvalidOperationException("Ticket not found.");
    }

    private async Task<TechAssistanceTicketResponse> LoadTicketResponseAsync(Guid ticketId)
        => ToResponse(await LoadTicketEntityForResponseAsync(ticketId));

    private async Task<TicketWriteState> LoadTicketStateAsync(Guid ticketId)
    {
        return await db.Set<TechAssistanceTicket>()
            .AsNoTracking()
            .Where(item => item.Id == ticketId)
            .Select(item => new TicketWriteState(item.Id, item.CabinetIdentityId, item.Status))
            .FirstOrDefaultAsync()
            ?? throw new InvalidOperationException("Ticket not found.");
    }

    private static TechAssistanceMessage BuildMessage(
        Guid ticketId,
        Doctor sender,
        string role,
        string message,
        bool readByRequester)
    {
        return new TechAssistanceMessage
        {
            Id = Guid.NewGuid(),
            TechAssistanceTicketId = ticketId,
            SenderDoctorId = sender.Id,
            SenderCabinetIdentityId = sender.CabinetIdentityId,
            SenderFirstName = sender.Firstname,
            SenderLastName = sender.Lastname,
            SenderEmail = sender.CabinetIdentity?.Email ?? string.Empty,
            SenderRole = role,
            Message = message,
            ReadByRequester = readByRequester,
            ReadByRequesterAt = readByRequester ? DateTime.UtcNow : null
        };
    }

    private async Task<List<TechAssistanceAttachment>> SaveAttachmentsAsync(
        Guid ticketId,
        Guid messageId,
        IEnumerable<IFormFile>? attachments)
    {
        var files = (attachments ?? []).Where(file => file is not null).ToList();
        if (files.Count > MaxAttachmentsPerMessage)
        {
            throw new InvalidOperationException($"A maximum of {MaxAttachmentsPerMessage} files can be attached.");
        }

        var saved = new List<TechAssistanceAttachment>();
        try
        {
            foreach (var file in files)
            {
                ValidateUploadedFile(file);

                var messageFolder = Path.Combine(
                    Directory.GetCurrentDirectory(),
                    "wwwroot",
                    StorageRootFolder,
                    ticketId.ToString("N"),
                    messageId.ToString("N"));
                Directory.CreateDirectory(messageFolder);

                var storedExtension = Path.GetExtension(file.FileName).ToLowerInvariant();
                var storedFileName = $"{DateTime.UtcNow:yyyyMMddHHmmss}_{Guid.NewGuid():N}{storedExtension}";
                var absoluteFilePath = Path.Combine(messageFolder, storedFileName);

                await using (var stream = new FileStream(absoluteFilePath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                saved.Add(new TechAssistanceAttachment
                {
                    Id = Guid.NewGuid(),
                    TechAssistanceMessageId = messageId,
                    OriginalFileName = NormalizeOriginalFileName(file.FileName),
                    StoredFileName = storedFileName,
                    RelativeFilePath = $"/{StorageRootFolder}/{ticketId:N}/{messageId:N}/{storedFileName}",
                    ContentType = NormalizeText(file.ContentType, 120),
                    FileSizeBytes = file.Length
                });
            }
        }
        catch
        {
            foreach (var attachment in saved)
            {
                DeleteStoredFile(attachment.RelativeFilePath);
            }

            throw;
        }

        return saved;
    }

    private async Task SaveChangesAndCleanUpOnFailureAsync(IEnumerable<TechAssistanceAttachment> attachments)
    {
        try
        {
            await db.SaveChangesAsync();
        }
        catch
        {
            foreach (var attachment in attachments)
            {
                DeleteStoredFile(attachment.RelativeFilePath);
            }

            throw;
        }
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
            throw new InvalidOperationException("This file type is not allowed.");
        }
    }

    private static string NormalizeRequired(string? value, string fieldName, int maxLength)
    {
        var normalized = NormalizeText(value, maxLength);
        if (normalized.Length == 0)
        {
            throw new InvalidOperationException($"{fieldName} is required.");
        }

        return normalized;
    }

    private static string NormalizeMessageWithOptionalAttachments(
        string? message,
        IEnumerable<IFormFile>? attachments)
    {
        var normalized = NormalizeMultilineText(message, MessageMaxLength);
        var hasAttachments = (attachments ?? []).Any(file => file.Length > 0);

        if (normalized.Length == 0 && !hasAttachments)
        {
            throw new InvalidOperationException("Message or attachment is required.");
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

        return normalized.Length <= maxLength
            ? normalized
            : normalized[..maxLength].TrimEnd();
    }

    private static string NormalizeMultilineText(string? value, int maxLength)
    {
        var normalized = (value ?? string.Empty)
            .Replace("\r\n", "\n")
            .Trim();

        return normalized.Length <= maxLength
            ? normalized
            : normalized[..maxLength].TrimEnd();
    }

    private static string NormalizeOriginalFileName(string? fileName)
    {
        var normalized = Path.GetFileName(fileName ?? string.Empty).Trim();
        return normalized.Length <= 260
            ? normalized
            : normalized[..260].TrimEnd();
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
    }

    private static void EnsureTechLeadPassword(string password)
    {
        var configuredPassword = Environment.GetEnvironmentVariable("tech_lead_pass") ?? string.Empty;
        if (string.IsNullOrWhiteSpace(configuredPassword))
        {
            throw new InvalidOperationException("tech_lead_pass environment variable is not set.");
        }

        var configuredBytes = Encoding.UTF8.GetBytes(configuredPassword);
        var providedBytes = Encoding.UTF8.GetBytes(password ?? string.Empty);

        if (configuredBytes.Length != providedBytes.Length ||
            !CryptographicOperations.FixedTimeEquals(configuredBytes, providedBytes))
        {
            throw new UnauthorizedAccessException("Invalid tech lead password.");
        }
    }

    private static string NormalizeRole(string? role)
        => (role ?? string.Empty).Trim().ToLowerInvariant();

    private static TechAssistanceTicketResponse ToResponse(TechAssistanceTicket ticket)
    {
        var messages = ticket.Messages
            .OrderBy(message => message.CreatedAt)
            .Select(ToResponse)
            .ToList();

        return new TechAssistanceTicketResponse
        {
            Id = ticket.Id,
            CabinetIdentityId = ticket.CabinetIdentityId,
            DoctorId = ticket.DoctorId,
            DoctorFirstName = ticket.DoctorFirstName,
            DoctorLastName = ticket.DoctorLastName,
            DoctorEmail = ticket.DoctorEmail,
            DoctorDisplayName = BuildDisplayName(ticket.DoctorFirstName, ticket.DoctorLastName),
            Subject = ticket.Subject,
            Status = ticket.Status,
            SeenByAdmins = ticket.SeenByAdmins,
            LastMessageAt = ticket.LastMessageAt,
            LastDoctorMessageAt = ticket.LastDoctorMessageAt,
            LastAdminMessageAt = ticket.LastAdminMessageAt,
            TechLeadNotifiedAt = ticket.TechLeadNotifiedAt,
            CreatedAt = ticket.CreatedAt,
            UpdatedAt = ticket.UpdatedAt,
            Participants = BuildParticipants(ticket, messages),
            Messages = messages
        };
    }

    private static TechAssistanceMessageResponse ToResponse(TechAssistanceMessage message)
    {
        return new TechAssistanceMessageResponse
        {
            Id = message.Id,
            TicketId = message.TechAssistanceTicketId,
            SenderDoctorId = message.SenderDoctorId,
            SenderCabinetIdentityId = message.SenderCabinetIdentityId,
            SenderFirstName = message.SenderFirstName,
            SenderLastName = message.SenderLastName,
            SenderEmail = message.SenderEmail,
            SenderRole = message.SenderRole,
            SenderDisplayName = BuildDisplayName(message.SenderFirstName, message.SenderLastName),
            Message = message.Message,
            ReadByRequester = message.ReadByRequester,
            CreatedAt = message.CreatedAt,
            Attachments = message.Attachments
                .OrderBy(attachment => attachment.CreatedAt)
                .Select(attachment => new TechAssistanceAttachmentResponse
                {
                    Id = attachment.Id,
                    MessageId = attachment.TechAssistanceMessageId,
                    OriginalFileName = attachment.OriginalFileName,
                    FileUrl = attachment.RelativeFilePath,
                    ContentType = attachment.ContentType,
                    FileSizeBytes = attachment.FileSizeBytes,
                    CreatedAt = attachment.CreatedAt
                })
                .ToList()
        };
    }

    private static List<TechAssistanceParticipantResponse> BuildParticipants(
        TechAssistanceTicket ticket,
        List<TechAssistanceMessageResponse> messages)
    {
        var participants = new List<TechAssistanceParticipantResponse>
        {
            new()
            {
                DoctorId = ticket.DoctorId,
                CabinetIdentityId = ticket.CabinetIdentityId,
                FirstName = ticket.DoctorFirstName,
                LastName = ticket.DoctorLastName,
                Email = ticket.DoctorEmail,
                Role = "requester",
                DisplayName = BuildDisplayName(ticket.DoctorFirstName, ticket.DoctorLastName)
            }
        };

        foreach (var message in messages)
        {
            if (participants.Any(item => item.DoctorId == message.SenderDoctorId))
            {
                continue;
            }

            participants.Add(new TechAssistanceParticipantResponse
            {
                DoctorId = message.SenderDoctorId,
                CabinetIdentityId = message.SenderCabinetIdentityId,
                FirstName = message.SenderFirstName,
                LastName = message.SenderLastName,
                Email = message.SenderEmail,
                Role = message.SenderRole,
                DisplayName = message.SenderDisplayName
            });
        }

        return participants;
    }

    private static string BuildDisplayName(string firstName, string lastName)
    {
        var displayName = $"Dr {firstName} {lastName}".Trim();
        return string.IsNullOrWhiteSpace(displayName) ? "Utilisateur" : displayName;
    }

    private sealed record TicketWriteState(Guid Id, Guid CabinetIdentityId, string Status);
}
