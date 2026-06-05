using System.Security.Claims;
using api.Src.Auth.Entities;
using api.Src.Auth.Helpers;
using api.Src.Suggestions.Dtos;
using api.Src.Suggestions.Entities;
using Microsoft.EntityFrameworkCore;

namespace api.Src.Suggestions.Services;

public class SuggestionService(AppDbContext db)
{
    private const int SubjectMaxLength = 180;
    private const int MessageMaxLength = 2000;

    public async Task<List<SuggestionResponse>> GetSuggestionsAsync(ClaimsPrincipal user)
    {
        var cabinetIdentityId = user.GetCabinetIdentityId();
        var role = NormalizeRole(user.GetRoleOrThrow());
        var isAdmin = IsAdminRole(role);

        var query = db.Set<DoctorSuggestion>()
            .AsQueryable();

        if (!isAdmin)
        {
            query = query.Where(item => item.CabinetIdentityId == cabinetIdentityId);
        }
        else
        {
            var unseen = await db.Set<DoctorSuggestion>()
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

        var suggestions = await query
            .AsNoTracking()
            .Include(item => item.Replies.OrderBy(reply => reply.CreatedAt))
            .OrderByDescending(item => item.UpdatedAt)
            .ToListAsync();

        if (!isAdmin)
        {
            var unreadReplies = suggestions
                .SelectMany(item => item.Replies)
                .Where(reply => !reply.ReadByDoctor)
                .Select(reply => reply.Id)
                .ToArray();

            if (unreadReplies.Length > 0)
            {
                await db.Set<DoctorSuggestionReply>()
                    .Where(reply => unreadReplies.Contains(reply.Id))
                    .ExecuteUpdateAsync(setters => setters
                        .SetProperty(reply => reply.ReadByDoctor, true)
                        .SetProperty(reply => reply.ReadByDoctorAt, DateTime.UtcNow));

                suggestions = await query
                    .AsNoTracking()
                    .Include(item => item.Replies.OrderBy(reply => reply.CreatedAt))
                    .OrderByDescending(item => item.UpdatedAt)
                    .ToListAsync();
            }
        }

        return suggestions.Select(ToResponse).ToList();
    }

    public async Task<SuggestionResponse> CreateSuggestionAsync(
        ClaimsPrincipal user,
        CreateSuggestionRequest request)
    {
        var role = NormalizeRole(user.GetRoleOrThrow());
        if (IsAdminRole(role))
        {
            throw new InvalidOperationException("Admins cannot create suggestions.");
        }

        var cabinetIdentityId = user.GetCabinetIdentityId();
        var doctor = await LoadDoctorAsync(cabinetIdentityId);
        var subject = NormalizeRequired(request.Subject, "Subject", SubjectMaxLength);
        var message = NormalizeRequired(request.Message, "Message", MessageMaxLength);

        var suggestion = new DoctorSuggestion
        {
            CabinetIdentityId = cabinetIdentityId,
            DoctorId = doctor.Id,
            DoctorFirstName = doctor.Firstname,
            DoctorLastName = doctor.Lastname,
            DoctorEmail = doctor.CabinetIdentity?.Email ?? string.Empty,
            Subject = subject,
            Message = message,
            Status = SuggestionStatuses.Open
        };

        db.Set<DoctorSuggestion>().Add(suggestion);
        await db.SaveChangesAsync();

        return ToResponse(suggestion);
    }

    public async Task<SuggestionResponse> ReplyAsync(
        ClaimsPrincipal user,
        Guid suggestionId,
        ReplyToSuggestionRequest request)
    {
        var role = NormalizeRole(user.GetRoleOrThrow());
        if (!IsAdminRole(role))
        {
            throw new InvalidOperationException("Only admin doctors can reply to suggestions.");
        }

        var cabinetIdentityId = user.GetCabinetIdentityId();
        var responder = await LoadDoctorAsync(cabinetIdentityId);
        var message = NormalizeRequired(request.Message, "Reply", MessageMaxLength);
        var suggestion = await db.Set<DoctorSuggestion>()
            .Include(item => item.Replies.OrderBy(reply => reply.CreatedAt))
            .FirstOrDefaultAsync(item => item.Id == suggestionId)
            ?? throw new InvalidOperationException("Suggestion not found.");

        suggestion.Replies.Add(new DoctorSuggestionReply
        {
            ResponderDoctorId = responder.Id,
            ResponderFirstName = responder.Firstname,
            ResponderLastName = responder.Lastname,
            ResponderRole = role,
            Message = message,
            ReadByDoctor = false
        });
        suggestion.Status = SuggestionStatuses.Answered;
        suggestion.LastReplyAt = DateTime.UtcNow;

        await db.SaveChangesAsync();
        return ToResponse(suggestion);
    }

    public async Task<SuggestionUnreadCountResponse> GetUnreadCountAsync(ClaimsPrincipal user)
    {
        var cabinetIdentityId = user.GetCabinetIdentityId();
        var role = NormalizeRole(user.GetRoleOrThrow());

        if (IsAdminRole(role))
        {
            return new SuggestionUnreadCountResponse
            {
                Count = await db.Set<DoctorSuggestion>().CountAsync(item => !item.SeenByAdmins)
            };
        }

        return new SuggestionUnreadCountResponse
        {
            Count = await db.Set<DoctorSuggestionReply>()
                .CountAsync(reply =>
                    !reply.ReadByDoctor &&
                    reply.Suggestion != null &&
                    reply.Suggestion.CabinetIdentityId == cabinetIdentityId)
        };
    }

    public async Task<int> GetAdminUnreadCountAsync()
        => await db.Set<DoctorSuggestion>().CountAsync(item => !item.SeenByAdmins);

    public async Task<int> GetDoctorUnreadCountAsync(Guid cabinetIdentityId)
        => await db.Set<DoctorSuggestionReply>()
            .CountAsync(reply =>
                !reply.ReadByDoctor &&
                reply.Suggestion != null &&
                reply.Suggestion.CabinetIdentityId == cabinetIdentityId);

    public static bool IsAdminRole(string? role)
        => NormalizeRole(role) is "admin" or "super_admin";

    private async Task<Doctor> LoadDoctorAsync(Guid cabinetIdentityId)
    {
        return await db.Doctors
            .Include(doctor => doctor.CabinetIdentity)
            .FirstOrDefaultAsync(doctor => doctor.CabinetIdentityId == cabinetIdentityId)
            ?? throw new InvalidOperationException("Doctor profile not found.");
    }

    private static string NormalizeRequired(string? value, string fieldName, int maxLength)
    {
        var normalized = (value ?? string.Empty).Trim();
        if (normalized.Length == 0)
        {
            throw new InvalidOperationException($"{fieldName} is required.");
        }

        if (normalized.Length > maxLength)
        {
            throw new InvalidOperationException($"{fieldName} is too long.");
        }

        return normalized;
    }

    private static string NormalizeRole(string? role)
        => (role ?? string.Empty).Trim().ToLowerInvariant();

    private static SuggestionResponse ToResponse(DoctorSuggestion suggestion)
    {
        return new SuggestionResponse
        {
            Id = suggestion.Id,
            CabinetIdentityId = suggestion.CabinetIdentityId,
            DoctorId = suggestion.DoctorId,
            DoctorFirstName = suggestion.DoctorFirstName,
            DoctorLastName = suggestion.DoctorLastName,
            DoctorEmail = suggestion.DoctorEmail,
            Subject = suggestion.Subject,
            Message = suggestion.Message,
            Status = suggestion.Status,
            SeenByAdmins = suggestion.SeenByAdmins,
            LastReplyAt = suggestion.LastReplyAt,
            CreatedAt = suggestion.CreatedAt,
            UpdatedAt = suggestion.UpdatedAt,
            Replies = suggestion.Replies
                .OrderBy(reply => reply.CreatedAt)
                .Select(reply => new SuggestionReplyResponse
                {
                    Id = reply.Id,
                    SuggestionId = reply.DoctorSuggestionId,
                    ResponderDoctorId = reply.ResponderDoctorId,
                    ResponderFirstName = reply.ResponderFirstName,
                    ResponderLastName = reply.ResponderLastName,
                    ResponderRole = reply.ResponderRole,
                    Message = reply.Message,
                    ReadByDoctor = reply.ReadByDoctor,
                    CreatedAt = reply.CreatedAt
                })
                .ToList()
        };
    }
}
