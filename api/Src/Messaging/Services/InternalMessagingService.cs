using System.Security.Claims;
using api.Src.Auth.Entities;
using api.Src.Auth.Helpers;
using api.Src.Messaging.Dtos;
using api.Src.Messaging.Entities;
using Microsoft.EntityFrameworkCore;

namespace api.Src.Messaging.Services;

public class InternalMessagingService(AppDbContext db)
{
    public const string SenderDoctor = "medecin";
    public const string SenderSecretary1 = "secretaire1";
    public const string SenderSecretary2 = "secretaire2";

    public async Task<InternalMessagingBootstrapResponse> GetBootstrapAsync(
        Guid cabinetIdentityId,
        ClaimsPrincipal user)
    {
        var identity = await LoadIdentityAsync(cabinetIdentityId);
        var sender = ResolveSender(user, null);
        var rooms = BuildAllowedRooms(identity, sender);
        await AttachUnreadCountsAsync(cabinetIdentityId, sender, rooms);

        return new InternalMessagingBootstrapResponse
        {
            CabinetIdentityId = cabinetIdentityId,
            DoctorId = identity.Doctor?.Id ?? Guid.Empty,
            CurrentSender = sender,
            HasSecondSecretary = HasSecondSecretary(identity),
            IsSecondSecretaryActive = identity.IsSecondSecretaryActive,
            Rooms = rooms
        };
    }

    public async Task<List<InternalMessageResponse>> GetMessagesByRoomAsync(
        Guid cabinetIdentityId,
        string roomId,
        ClaimsPrincipal user)
    {
        await EnsureRoomAccessAsync(cabinetIdentityId, roomId, user);

        return await db.Set<InternalMessage>()
            .AsNoTracking()
            .Where(message => message.CabinetIdentityId == cabinetIdentityId && message.RoomId == roomId)
            .OrderBy(message => message.CreatedAt)
            .Select(message => ToResponse(message))
            .ToListAsync();
    }

    public async Task<List<InternalMessageResponse>> GetMessagesForCabinetAsync(
        Guid cabinetIdentityId,
        ClaimsPrincipal user)
    {
        var identity = await LoadIdentityAsync(cabinetIdentityId);
        var sender = ResolveSender(user, null);
        var roomIds = BuildAllowedRooms(identity, sender).Select(room => room.RoomId).ToHashSet();

        return await db.Set<InternalMessage>()
            .AsNoTracking()
            .Where(message => message.CabinetIdentityId == cabinetIdentityId && roomIds.Contains(message.RoomId))
            .OrderBy(message => message.CreatedAt)
            .Select(message => ToResponse(message))
            .ToListAsync();
    }

    public async Task<InternalMessageResponse> CreateMessageAsync(
        Guid cabinetIdentityId,
        SendInternalMessageRequest request,
        ClaimsPrincipal user)
    {
        var content = NormalizeMessageContent(request.Content);
        var sender = ResolveSender(user, request.Sender);
        await EnsureRoomAccessAsync(cabinetIdentityId, request.RoomId, user, sender);

        var message = new InternalMessage
        {
            CabinetIdentityId = cabinetIdentityId,
            RoomId = request.RoomId.Trim(),
            Sender = sender,
            Content = content,
            SeenBy = [sender]
        };

        db.Set<InternalMessage>().Add(message);
        await db.SaveChangesAsync();

        return ToResponse(message);
    }

    public async Task<InternalMessageResponse> EditMessageAsync(
        Guid cabinetIdentityId,
        Guid messageId,
        EditInternalMessageRequest request,
        ClaimsPrincipal user)
    {
        var content = NormalizeMessageContent(request.Content);
        var sender = ResolveSender(user, request.Sender);
        var message = await GetOwnedMessageAsync(cabinetIdentityId, messageId, sender);

        if (message.DeletedAt.HasValue)
        {
            throw new InvalidOperationException("Deleted message cannot be edited.");
        }

        await EnsureRoomAccessAsync(cabinetIdentityId, message.RoomId, user, sender);

        message.Content = content;
        message.EditedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        return ToResponse(message);
    }

    public async Task<InternalMessageResponse> DeleteMessageAsync(
        Guid cabinetIdentityId,
        Guid messageId,
        DeleteInternalMessageRequest request,
        ClaimsPrincipal user)
    {
        var sender = ResolveSender(user, request.Sender);
        var message = await GetOwnedMessageAsync(cabinetIdentityId, messageId, sender);
        await EnsureRoomAccessAsync(cabinetIdentityId, message.RoomId, user, sender);

        message.Content = "Message supprime";
        message.DeletedAt = DateTime.UtcNow;
        message.EditedAt = null;
        await db.SaveChangesAsync();

        return ToResponse(message);
    }

    public async Task<List<InternalMessageResponse>> MarkRoomSeenAsync(
        Guid cabinetIdentityId,
        string roomId,
        MarkInternalRoomSeenRequest request,
        ClaimsPrincipal user)
    {
        var viewer = ResolveSender(user, request.Viewer);
        await EnsureRoomAccessAsync(cabinetIdentityId, roomId, user, viewer);

        var messages = await db.Set<InternalMessage>()
            .Where(message => message.CabinetIdentityId == cabinetIdentityId && message.RoomId == roomId)
            .OrderBy(message => message.CreatedAt)
            .ToListAsync();

        foreach (var message in messages)
        {
            if (message.Sender == viewer || message.DeletedAt.HasValue || message.SeenBy.Contains(viewer))
            {
                continue;
            }

            message.SeenBy = [.. message.SeenBy, viewer];
            message.IsRead = true;
        }

        await db.SaveChangesAsync();
        return messages.Select(ToResponse).ToList();
    }

    public async Task EnsureRoomAccessAsync(
        Guid cabinetIdentityId,
        string roomId,
        ClaimsPrincipal user,
        string? resolvedSender = null)
    {
        var identity = await LoadIdentityAsync(cabinetIdentityId);
        var sender = resolvedSender ?? ResolveSender(user, null);
        var normalizedRoomId = (roomId ?? string.Empty).Trim();
        var allowedRooms = BuildAllowedRooms(identity, sender);

        if (!allowedRooms.Any(room => string.Equals(room.RoomId, normalizedRoomId, StringComparison.Ordinal)))
        {
            throw new InvalidOperationException("Room is not available for this user.");
        }
    }

    public async Task<List<InternalMessagingRoomResponse>> GetAllowedRoomsAsync(
        Guid cabinetIdentityId,
        ClaimsPrincipal user)
    {
        var identity = await LoadIdentityAsync(cabinetIdentityId);
        var sender = ResolveSender(user, null);
        return BuildAllowedRooms(identity, sender);
    }

    private async Task AttachUnreadCountsAsync(
        Guid cabinetIdentityId,
        string viewer,
        List<InternalMessagingRoomResponse> rooms)
    {
        if (rooms.Count == 0)
        {
            return;
        }

        var roomIds = rooms.Select(room => room.RoomId).ToArray();
        var unreadCounts = await db.Set<InternalMessage>()
            .AsNoTracking()
            .Where(message =>
                message.CabinetIdentityId == cabinetIdentityId &&
                roomIds.Contains(message.RoomId) &&
                message.Sender != viewer &&
                !message.DeletedAt.HasValue &&
                !message.SeenBy.Contains(viewer))
            .GroupBy(message => message.RoomId)
            .Select(group => new { RoomId = group.Key, Count = group.Count() })
            .ToDictionaryAsync(item => item.RoomId, item => item.Count);

        foreach (var room in rooms)
        {
            room.UnreadCount = unreadCounts.GetValueOrDefault(room.RoomId);
        }
    }

    public string ResolveSender(ClaimsPrincipal user, string? requestedSender)
    {
        var role = NormalizeRole(user.GetRoleOrThrow());
        if (role is "doctor" or "admin" or "super_admin" or "medecin")
        {
            return SenderDoctor;
        }

        var profileRole = NormalizeRole(
            user.FindFirstValue("profile_role")
            ?? user.FindFirstValue("selected_role")
            ?? user.FindFirstValue("app_role"));

        if (profileRole is "secretary2" or "secretaire2")
        {
            return SenderSecretary2;
        }

        if (profileRole is "secretary1" or "secretaire1")
        {
            return SenderSecretary1;
        }

        var requested = NormalizeSender(requestedSender);
        if (role is "secretary" or "secretaire")
        {
            return requested is SenderSecretary2 ? SenderSecretary2 : SenderSecretary1;
        }

        return requested ?? SenderDoctor;
    }

    public static string BuildGroupRoomId(Guid cabinetIdentityId)
        => $"cabinet-{cabinetIdentityId:D}-group";

    public static string BuildSecretary1RoomId(Guid cabinetIdentityId)
        => $"cabinet-{cabinetIdentityId:D}-sec-1";

    public static string BuildSecretary2RoomId(Guid cabinetIdentityId)
        => $"cabinet-{cabinetIdentityId:D}-sec-2";

    private async Task<CabinetIdentity> LoadIdentityAsync(Guid cabinetIdentityId)
    {
        return await db.CabinetIdentities
            .Include(identity => identity.Doctor)
            .Include(identity => identity.Secretaries)
            .FirstOrDefaultAsync(identity => identity.Id == cabinetIdentityId)
            ?? throw new InvalidOperationException("Cabinet identity not found.");
    }

    private static List<InternalMessagingRoomResponse> BuildAllowedRooms(CabinetIdentity identity, string sender)
    {
        var cabinetIdentityId = identity.Id;
        var rooms = new List<InternalMessagingRoomResponse>
        {
            new()
            {
                Key = "group",
                RoomId = BuildGroupRoomId(cabinetIdentityId),
                Label = "Discussion Groupe",
                IsGroup = true
            }
        };

        var hasFirstSecretary = identity.Secretaries.Any(sec => sec.SecretaryIndex == 1)
            || identity.Secretaries.Count > 0;
        var hasSecondSecretary = HasSecondSecretary(identity);
        var canSeeFirstSecretary = sender is SenderDoctor or SenderSecretary1;
        var canSeeSecondSecretary = hasSecondSecretary && (sender is SenderDoctor or SenderSecretary2);

        if (hasFirstSecretary && canSeeFirstSecretary)
        {
            rooms.Add(new InternalMessagingRoomResponse
            {
                Key = "sec1",
                RoomId = BuildSecretary1RoomId(cabinetIdentityId),
                Label = "Prive Secretaire 1",
                IsGroup = false
            });
        }

        if (canSeeSecondSecretary)
        {
            rooms.Add(new InternalMessagingRoomResponse
            {
                Key = "sec2",
                RoomId = BuildSecretary2RoomId(cabinetIdentityId),
                Label = "Prive Secretaire 2",
                IsGroup = false
            });
        }

        return rooms;
    }

    private static bool HasSecondSecretary(CabinetIdentity identity)
    {
        var hasSecondSecretary = identity.Secretaries.Any(sec => sec.SecretaryIndex == 2)
            || identity.Secretaries.Count > 1;

        return identity.IsSecondSecretaryActive && hasSecondSecretary;
    }

    private async Task<InternalMessage> GetOwnedMessageAsync(
        Guid cabinetIdentityId,
        Guid messageId,
        string sender)
    {
        var message = await db.Set<InternalMessage>()
            .FirstOrDefaultAsync(item => item.CabinetIdentityId == cabinetIdentityId && item.Id == messageId)
            ?? throw new InvalidOperationException("Message not found.");

        if (message.Sender != sender)
        {
            throw new InvalidOperationException("Not allowed to edit this message.");
        }

        return message;
    }

    private static string NormalizeMessageContent(string? content)
    {
        var value = (content ?? string.Empty).Trim();
        if (value.Length == 0)
        {
            throw new InvalidOperationException("Message content is required.");
        }

        if (value.Length > 1000)
        {
            throw new InvalidOperationException("Message content is too long.");
        }

        return value;
    }

    private static string NormalizeRole(string? value)
        => (value ?? string.Empty).Trim().ToLowerInvariant();

    private static string? NormalizeSender(string? value)
    {
        var normalized = NormalizeRole(value);
        return normalized switch
        {
            SenderDoctor or "doctor" or "medecin" => SenderDoctor,
            SenderSecretary1 or "secretary1" or "secretaire1" => SenderSecretary1,
            SenderSecretary2 or "secretary2" or "secretaire2" => SenderSecretary2,
            _ => null
        };
    }

    private static InternalMessageResponse ToResponse(InternalMessage message)
    {
        return new InternalMessageResponse
        {
            Id = message.Id,
            CabinetIdentityId = message.CabinetIdentityId,
            RoomId = message.RoomId,
            Sender = message.Sender,
            Content = message.Content,
            EditedAt = message.EditedAt,
            DeletedAt = message.DeletedAt,
            SeenBy = message.SeenBy,
            IsRead = message.IsRead,
            CreatedAt = message.CreatedAt
        };
    }
}
