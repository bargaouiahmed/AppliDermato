using System;
using api.Src.Admin.Dtos.Requests;
using api.Src.Admin.Dtos.Responses;
using api.Src.Auth.Entities;
using api.Src.Suggestions.Entities;
using api.Src.Smtp.Services;
using api.Src.Subscription.Entities;
using Microsoft.EntityFrameworkCore;

namespace api.Src.Admin.Services;

public class AdminService(AppDbContext db, ISmtpService smtpService) : IAdminService
{
    public async Task AddNewDoctorAsync(AddNewDoctorRequest request)
    {
        var normalizedRole = request.Role.Trim().ToLowerInvariant();

        if (await db.CabinetIdentities.AnyAsync(d => d.Email == request.Email))
        {
            throw new Exception("A doctor with the same email already exists.");
        }

        if (!new[] { "doctor", "admin" }.Contains(normalizedRole))
        {
            throw new Exception("Invalid role. Please specify either 'doctor' or 'admin'.");
        }

        request.Role = normalizedRole + "_auto_pass_unchanged";

        var cabinetIdentity = new CabinetIdentity
        {
            Email = request.Email,
            Country = request.CabinetCountry,
            Address = request.CabinetAddress,
            PostalCode = request.CabinetPostalCode,
            City = request.CabinetCity,
            IsActive = true,
            AdminNotes = request.NotesFromAdmin,
        };

        var password = $"dr-{request.Lastname.ToLower()}-{request.Firstname.ToLower()[0]}.{Environment.GetEnvironmentVariable("brand_name") ?? "Generalisto"}{GenerateRandomNumericalString(6)}";
        if (!cabinetIdentity.HashAndUpdatePassword(password))
        {
            throw new Exception("Failed to generate a valid password for the new doctor.");
        }

        var subscriptionEndDate = DateTime.UtcNow.AddMonths(request.SubscriptionDurationInMonths);

        var doctor = new Doctor
        {
            Firstname = request.Firstname,
            Lastname = request.Lastname,
            Nationality = request.Nationality,
            PhoneNumber = request.PhoneNumber,
            Landline = request.Landline,
            LanguagePreference = request.LanguagePreference,
            CabinetIdentity = cabinetIdentity,
            Role = request.Role.ToLowerInvariant(),
        };

        if (request.Role.StartsWith("admin", StringComparison.OrdinalIgnoreCase))
        {
            subscriptionEndDate = DateTime.UtcNow.AddYears(1000);
        }

        var activeSubscription = new ActiveSubscription
        {
            StartDate = DateTime.UtcNow,
            EndDate = subscriptionEndDate,
            DurationInMonths = request.SubscriptionDurationInMonths,
            IsActive = true,
            CabinetIdentity = cabinetIdentity,
            SubscriptionType = request.Role.StartsWith("admin", StringComparison.OrdinalIgnoreCase) ? "admin" : "trial",
        };

        db.CabinetIdentities.Add(cabinetIdentity);
        db.Doctors.Add(doctor);
        db.ActiveSubscriptions.Add(activeSubscription);

        await db.SaveChangesAsync();
        await smtpService.SendDoctorAccountCreatedEmailAsync(request.Email, password, request.Firstname, request.Lastname);
    }

    public async Task<ListDoctorsResponse> GetDoctorsAsync(
        int pageNumber,
        int pageSize,
        string? searchQuery,
        string? sortBy,
        string? sortDirection,
        string? roleFilter,
        string? statusFilter)
    {
        if (pageNumber < 1) pageNumber = 1;
        if (pageSize < 1) pageSize = 10;
        if (pageSize > 100) pageSize = 100;

        var now = DateTime.UtcNow;
        var expiringSoonThreshold = now.AddDays(7);

        var query = db.Doctors
            .AsNoTracking()
            .Include(d => d.CabinetIdentity)
            .ThenInclude(ci => ci!.ActiveSubscriptions)
            .Where(d => d.Role.StartsWith("doctor") || d.Role.StartsWith("admin") || d.Role.StartsWith("super_admin"));

        if (!string.IsNullOrWhiteSpace(searchQuery))
        {
            var search = searchQuery.Trim();
            query = query.Where(d =>
                d.Firstname.Contains(search) ||
                d.Lastname.Contains(search) ||
                d.Nationality.Contains(search) ||
                d.PhoneNumber.Contains(search) ||
                (d.CabinetIdentity != null &&
                 (d.CabinetIdentity.Email.Contains(search) ||
                  d.CabinetIdentity.City.Contains(search) ||
                  d.CabinetIdentity.Country.Contains(search))));
        }

        var normalizedRoleFilter = roleFilter?.Trim().ToLowerInvariant();
        if (!string.IsNullOrEmpty(normalizedRoleFilter))
        {
            query = normalizedRoleFilter switch
            {
                "admin" => query.Where(d => d.Role.StartsWith("admin") || d.Role.StartsWith("super_admin")),
                "doctor" => query.Where(d => d.Role.StartsWith("doctor")),
                _ => query,
            };
        }

        var normalizedStatusFilter = statusFilter?.Trim().ToLowerInvariant();
        if (!string.IsNullOrEmpty(normalizedStatusFilter))
        {
            query = normalizedStatusFilter switch
            {
                "suspended" => query.Where(d =>
                    d.CabinetIdentity != null &&
                    !d.CabinetIdentity.IsActive &&
                    !d.CabinetIdentity.IsFlaggedForDeletion),
                "deleted" => query.Where(d =>
                    d.CabinetIdentity != null &&
                    d.CabinetIdentity.IsFlaggedForDeletion),
                "not_suspended" => query.Where(d =>
                    d.CabinetIdentity != null &&
                    d.CabinetIdentity.IsActive &&
                    !d.CabinetIdentity.IsFlaggedForDeletion),
                "admin" => query.Where(d => d.Role.StartsWith("admin") || d.Role.StartsWith("super_admin")),
                "active" => query.Where(d =>
                    d.Role.StartsWith("doctor") &&
                    d.CabinetIdentity != null &&
                    d.CabinetIdentity.IsActive &&
                    !d.CabinetIdentity.IsFlaggedForDeletion &&
                    d.CabinetIdentity.ActiveSubscriptions != null &&
                    d.CabinetIdentity.ActiveSubscriptions.IsActive &&
                    d.CabinetIdentity.ActiveSubscriptions.EndDate > expiringSoonThreshold),
                "expiring_soon" => query.Where(d =>
                    d.Role.StartsWith("doctor") &&
                    d.CabinetIdentity != null &&
                    d.CabinetIdentity.IsActive &&
                    !d.CabinetIdentity.IsFlaggedForDeletion &&
                    d.CabinetIdentity.ActiveSubscriptions != null &&
                    d.CabinetIdentity.ActiveSubscriptions.IsActive &&
                    d.CabinetIdentity.ActiveSubscriptions.EndDate > now &&
                    d.CabinetIdentity.ActiveSubscriptions.EndDate <= expiringSoonThreshold),
                "expired" => query.Where(d =>
                    d.Role.StartsWith("doctor") &&
                    d.CabinetIdentity != null &&
                    d.CabinetIdentity.IsActive &&
                    !d.CabinetIdentity.IsFlaggedForDeletion &&
                    (d.CabinetIdentity.ActiveSubscriptions == null ||
                     !d.CabinetIdentity.ActiveSubscriptions.IsActive ||
                     d.CabinetIdentity.ActiveSubscriptions.EndDate <= now)),
                _ => query,
            };
        }

        var ascending = string.Equals(sortDirection, "asc", StringComparison.OrdinalIgnoreCase);
        query = sortBy?.Trim().ToLowerInvariant() switch
        {
            "firstname" => ascending ? query.OrderBy(d => d.Firstname) : query.OrderByDescending(d => d.Firstname),
            "lastname" => ascending ? query.OrderBy(d => d.Lastname) : query.OrderByDescending(d => d.Lastname),
            "email" => ascending
                ? query.OrderBy(d => d.CabinetIdentity != null ? d.CabinetIdentity.Email : string.Empty)
                : query.OrderByDescending(d => d.CabinetIdentity != null ? d.CabinetIdentity.Email : string.Empty),
            "city" => ascending
                ? query.OrderBy(d => d.CabinetIdentity != null ? d.CabinetIdentity.City : string.Empty)
                : query.OrderByDescending(d => d.CabinetIdentity != null ? d.CabinetIdentity.City : string.Empty),
            "role" => ascending ? query.OrderBy(d => d.Role) : query.OrderByDescending(d => d.Role),
            "subscriptionenddate" => ascending
                ? query.OrderBy(d => d.CabinetIdentity != null && d.CabinetIdentity.ActiveSubscriptions != null
                    ? d.CabinetIdentity.ActiveSubscriptions.EndDate
                    : DateTime.MaxValue)
                : query.OrderByDescending(d => d.CabinetIdentity != null && d.CabinetIdentity.ActiveSubscriptions != null
                    ? d.CabinetIdentity.ActiveSubscriptions.EndDate
                    : DateTime.MaxValue),
            _ => query.OrderByDescending(d => d.CreatedAt),
        };

        var totalCount = await query.CountAsync();

        var doctors = await query
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .Select(d => new DoctorListItemResponse
            {
                Id = d.Id,
                CabinetIdentityId = d.CabinetIdentityId,
                Firstname = d.Firstname,
                Lastname = d.Lastname,
                Email = d.CabinetIdentity != null ? d.CabinetIdentity.Email : string.Empty,
                Nationality = d.Nationality,
                Role = d.Role,
                IsSuperAdmin = d.Role.StartsWith("super_admin"),
                PhoneNumber = d.PhoneNumber,
                Landline = d.Landline,
                LanguagePreference = d.LanguagePreference,
                CabinetCountry = d.CabinetIdentity != null ? d.CabinetIdentity.Country : string.Empty,
                CabinetCity = d.CabinetIdentity != null ? d.CabinetIdentity.City : string.Empty,
                CabinetAddress = d.CabinetIdentity != null ? d.CabinetIdentity.Address : string.Empty,
                CabinetPostalCode = d.CabinetIdentity != null ? d.CabinetIdentity.PostalCode : string.Empty,
                NotesFromAdmin = d.CabinetIdentity != null ? d.CabinetIdentity.AdminNotes : null,
                ProfilePictureUrl = d.CabinetIdentity != null ? d.CabinetIdentity.ProfilePictureUrl : null,
                IsCabinetActive = d.CabinetIdentity != null && d.CabinetIdentity.IsActive,
                IsFlaggedForDeletion = d.CabinetIdentity != null && d.CabinetIdentity.IsFlaggedForDeletion,
                SubscriptionStartDate = d.CabinetIdentity != null && d.CabinetIdentity.ActiveSubscriptions != null ? d.CabinetIdentity.ActiveSubscriptions.StartDate : null,
                SubscriptionEndDate = d.CabinetIdentity != null && d.CabinetIdentity.ActiveSubscriptions != null ? d.CabinetIdentity.ActiveSubscriptions.EndDate : null,
                SubscriptionDurationInMonths = d.CabinetIdentity != null && d.CabinetIdentity.ActiveSubscriptions != null ? d.CabinetIdentity.ActiveSubscriptions.DurationInMonths : null,
                SubscriptionIsActive = d.CabinetIdentity != null && d.CabinetIdentity.ActiveSubscriptions != null && d.CabinetIdentity.ActiveSubscriptions.IsActive,
                SubscriptionType = d.CabinetIdentity != null && d.CabinetIdentity.ActiveSubscriptions != null ? d.CabinetIdentity.ActiveSubscriptions.SubscriptionType : string.Empty,
                CreatedAt = d.CreatedAt,
            })
            .ToListAsync();

        foreach (var doctor in doctors)
        {
            var normalizedRole = NormalizeRole(doctor.Role);
            doctor.Role = normalizedRole;

            if (doctor.IsFlaggedForDeletion)
            {
                doctor.SubscriptionStatus = "deleted";
                doctor.SubscriptionDaysRemaining = null;
                continue;
            }

            if (!doctor.IsCabinetActive)
            {
                doctor.SubscriptionStatus = "suspended";
                doctor.SubscriptionDaysRemaining = null;
                continue;
            }

            if (normalizedRole == "admin")
            {
                doctor.SubscriptionStatus = "admin";
                doctor.SubscriptionDaysRemaining = null;
                continue;
            }

            var endDate = doctor.SubscriptionEndDate;
            var isValidSubscription = doctor.SubscriptionIsActive && endDate.HasValue;
            if (!isValidSubscription)
            {
                doctor.SubscriptionStatus = "expired";
                doctor.SubscriptionDaysRemaining = null;
                continue;
            }

            var validEndDate = endDate!.Value;
            var remainingDays = (int)Math.Floor((validEndDate - now).TotalDays);
            doctor.SubscriptionDaysRemaining = remainingDays;

            if (validEndDate <= now)
            {
                doctor.SubscriptionStatus = "expired";
            }
            else if (validEndDate <= expiringSoonThreshold)
            {
                doctor.SubscriptionStatus = "expiring_soon";
            }
            else
            {
                doctor.SubscriptionStatus = "active";
            }
        }

        return new ListDoctorsResponse
        {
            Doctors = doctors,
            TotalCount = totalCount,
        };
    }

    public async Task<DoctorListItemResponse> GetDoctorByIdAsync(Guid doctorId)
    {
        var doctor = await db.Doctors
            .AsNoTracking()
            .Include(d => d.CabinetIdentity)
            .ThenInclude(ci => ci!.ActiveSubscriptions)
            .FirstOrDefaultAsync(d => d.Id == doctorId)
            ?? throw new InvalidOperationException("Doctor not found");

        return BuildDoctorListItemResponse(doctor, DateTime.UtcNow);
    }

    public async Task<DoctorListItemResponse> UpdateDoctorByAdminAsync(Guid doctorId, UpdateDoctorByAdminRequest request)
    {
        var doctor = await db.Doctors
            .Include(d => d.CabinetIdentity)
            .ThenInclude(ci => ci!.ActiveSubscriptions)
            .FirstOrDefaultAsync(d => d.Id == doctorId)
            ?? throw new InvalidOperationException("Doctor not found");

        if (doctor.CabinetIdentity == null)
        {
            throw new InvalidOperationException("Cabinet identity not found");
        }

        var identity = doctor.CabinetIdentity;

        if (!string.IsNullOrWhiteSpace(request.Email))
        {
            var nextEmail = request.Email.Trim();
            if (!string.Equals(identity.Email, nextEmail, StringComparison.OrdinalIgnoreCase))
            {
                var emailAlreadyUsed = await db.CabinetIdentities.AnyAsync(ci =>
                    ci.Email == nextEmail &&
                    ci.Id != identity.Id);

                if (emailAlreadyUsed)
                {
                    throw new InvalidOperationException("A doctor with the same email already exists.");
                }

                identity.Email = nextEmail;
            }
        }

        if (!string.IsNullOrWhiteSpace(request.Firstname)) doctor.Firstname = request.Firstname.Trim();
        if (!string.IsNullOrWhiteSpace(request.Lastname)) doctor.Lastname = request.Lastname.Trim();
        if (!string.IsNullOrWhiteSpace(request.Nationality)) doctor.Nationality = request.Nationality.Trim();
        if (!string.IsNullOrWhiteSpace(request.PhoneNumber)) doctor.PhoneNumber = request.PhoneNumber.Trim();
        if (!string.IsNullOrWhiteSpace(request.Landline)) doctor.Landline = request.Landline.Trim();
        if (!string.IsNullOrWhiteSpace(request.CabinetCountry)) identity.Country = request.CabinetCountry.Trim();
        if (!string.IsNullOrWhiteSpace(request.CabinetCity)) identity.City = request.CabinetCity.Trim();
        if (!string.IsNullOrWhiteSpace(request.CabinetAddress)) identity.Address = request.CabinetAddress.Trim();
        if (!string.IsNullOrWhiteSpace(request.CabinetPostalCode)) identity.PostalCode = request.CabinetPostalCode.Trim();
        if (request.NotesFromAdmin != null) identity.AdminNotes = request.NotesFromAdmin.Trim();

        if (!string.IsNullOrWhiteSpace(request.LanguagePreference))
        {
            var nextLanguage = request.LanguagePreference.Trim().ToLowerInvariant();
            if (nextLanguage is not ("fr" or "en" or "ar"))
            {
                throw new InvalidOperationException("Invalid language preference. Please use 'fr', 'en', or 'ar'.");
            }

            doctor.LanguagePreference = nextLanguage;
        }

        await db.SaveChangesAsync();
        return BuildDoctorListItemResponse(doctor, DateTime.UtcNow);
    }

    public async Task SuspendDoctorAsync(Guid doctorId, Guid actorCabinetIdentityId)
    {
        var doctor = await db.Doctors
            .Include(d => d.CabinetIdentity)
            .FirstOrDefaultAsync(d => d.Id == doctorId)
            ?? throw new InvalidOperationException("Doctor not found");

        if (doctor.CabinetIdentity == null)
        {
            throw new InvalidOperationException("Cabinet identity not found");
        }

        if (doctor.CabinetIdentityId == actorCabinetIdentityId)
        {
            throw new InvalidOperationException("You cannot suspend your own account.");
        }

        if (IsSuperAdminRole(doctor.Role))
        {
            throw new InvalidOperationException("Super admin accounts cannot be suspended.");
        }

        doctor.CabinetIdentity.IsActive = false;
        await db.SaveChangesAsync();
    }

    public async Task ReactivateDoctorAsync(Guid doctorId, Guid actorCabinetIdentityId, int? subscriptionDurationInMonths)
    {
        var doctor = await db.Doctors
            .Include(d => d.CabinetIdentity)
            .ThenInclude(ci => ci!.ActiveSubscriptions)
            .FirstOrDefaultAsync(d => d.Id == doctorId)
            ?? throw new InvalidOperationException("Doctor not found");

        if (doctor.CabinetIdentity == null)
        {
            throw new InvalidOperationException("Cabinet identity not found");
        }

        if (doctor.CabinetIdentityId == actorCabinetIdentityId)
        {
            throw new InvalidOperationException("You cannot reactivate your own account.");
        }

        if (IsSuperAdminRole(doctor.Role))
        {
            throw new InvalidOperationException("Super admin accounts cannot be reactivated from this endpoint.");
        }

        var now = DateTime.UtcNow;

        doctor.CabinetIdentity.IsActive = true;
        doctor.CabinetIdentity.IsFlaggedForDeletion = false;
        doctor.CabinetIdentity.FlaggedForDeletionAt = null;

        var normalizedRole = NormalizeRole(doctor.Role);
        var subscription = EnsureSubscription(doctor, now);

        if (normalizedRole == "doctor")
        {
            var durationInMonths = NormalizeSubscriptionDuration(subscriptionDurationInMonths);
            subscription.StartDate = now;
            subscription.EndDate = now.AddMonths(durationInMonths);
            subscription.DurationInMonths = durationInMonths;
            subscription.IsActive = true;
            subscription.SubscriptionType = "manual";
        }
        else
        {
            subscription.StartDate = now;
            subscription.EndDate = now.AddYears(1000);
            subscription.DurationInMonths = subscription.DurationInMonths > 0 ? subscription.DurationInMonths : 12000;
            subscription.IsActive = true;
            subscription.SubscriptionType = "admin";
        }

        await db.SaveChangesAsync();
    }

    public async Task ChangeDoctorRoleAsync(Guid doctorId, Guid actorCabinetIdentityId, string actorRole, string targetRole, int? subscriptionDurationInMonths)
    {
        var doctor = await db.Doctors
            .Include(d => d.CabinetIdentity)
            .ThenInclude(ci => ci!.ActiveSubscriptions)
            .FirstOrDefaultAsync(d => d.Id == doctorId)
            ?? throw new InvalidOperationException("Doctor not found");

        if (doctor.CabinetIdentity == null)
        {
            throw new InvalidOperationException("Cabinet identity not found");
        }

        if (doctor.CabinetIdentityId == actorCabinetIdentityId)
        {
            throw new InvalidOperationException("You cannot change your own role.");
        }

        if (IsSuperAdminRole(doctor.Role))
        {
            throw new InvalidOperationException("Super admin role cannot be changed from this endpoint.");
        }

        var normalizedTargetRole = targetRole.Trim().ToLowerInvariant();
        if (normalizedTargetRole is not ("doctor" or "admin"))
        {
            throw new InvalidOperationException("Invalid role. Please specify either 'doctor' or 'admin'.");
        }

        var now = DateTime.UtcNow;
        var subscription = EnsureSubscription(doctor, now);

        if (normalizedTargetRole == "admin")
        {
            doctor.Role = "admin";
            subscription.StartDate = now;
            subscription.EndDate = now.AddYears(1000);
            subscription.DurationInMonths = subscription.DurationInMonths > 0 ? subscription.DurationInMonths : 12000;
            subscription.IsActive = true;
            subscription.SubscriptionType = "admin";
        }
        else
        {
            var durationInMonths = NormalizeSubscriptionDuration(subscriptionDurationInMonths);
            doctor.Role = "doctor";
            subscription.StartDate = now;
            subscription.EndDate = now.AddMonths(durationInMonths);
            subscription.DurationInMonths = durationInMonths;
            subscription.IsActive = true;
            subscription.SubscriptionType = "manual";
        }

        doctor.CabinetIdentity.IsActive = true;
        doctor.CabinetIdentity.IsFlaggedForDeletion = false;
        doctor.CabinetIdentity.FlaggedForDeletionAt = null;

        await db.SaveChangesAsync();
    }

    public async Task RemoveAdminAsync(Guid doctorId, Guid actorCabinetIdentityId, string actorRole)
    {
        if (!IsSuperAdminRole(actorRole))
        {
            throw new InvalidOperationException("Only super admins can remove admin accounts.");
        }

        var doctor = await db.Doctors
            .Include(d => d.CabinetIdentity)
            .ThenInclude(ci => ci!.ActiveSubscriptions)
            .FirstOrDefaultAsync(d => d.Id == doctorId)
            ?? throw new InvalidOperationException("Doctor not found");

        if (doctor.CabinetIdentity == null)
        {
            throw new InvalidOperationException("Cabinet identity not found");
        }

        if (doctor.CabinetIdentityId == actorCabinetIdentityId)
        {
            throw new InvalidOperationException("You cannot remove your own account.");
        }

        if (IsSuperAdminRole(doctor.Role))
        {
            throw new InvalidOperationException("Super admin accounts cannot be removed.");
        }

        if (NormalizeRole(doctor.Role) != "admin")
        {
            throw new InvalidOperationException("Only admin accounts can be removed from this endpoint.");
        }

        doctor.CabinetIdentity.IsActive = false;
        doctor.CabinetIdentity.IsFlaggedForDeletion = true;
        doctor.CabinetIdentity.FlaggedForDeletionAt = DateTime.UtcNow;

        if (doctor.CabinetIdentity.ActiveSubscriptions != null)
        {
            doctor.CabinetIdentity.ActiveSubscriptions.IsActive = false;
        }

        await db.SaveChangesAsync();
    }

    public async Task DeleteDoctorAsync(Guid doctorId, Guid actorCabinetIdentityId, string actorRole)
    {
        var doctor = await db.Doctors
            .Include(d => d.CabinetIdentity)
            .ThenInclude(ci => ci!.ActiveSubscriptions)
            .FirstOrDefaultAsync(d => d.Id == doctorId)
            ?? throw new InvalidOperationException("Doctor not found");

        if (doctor.CabinetIdentity == null)
        {
            throw new InvalidOperationException("Cabinet identity not found");
        }

        if (doctor.CabinetIdentityId == actorCabinetIdentityId)
        {
            throw new InvalidOperationException("You cannot delete your own account.");
        }

        if (IsSuperAdminRole(doctor.Role))
        {
            throw new InvalidOperationException("Super admin accounts cannot be deleted.");
        }

        if (NormalizeRole(doctor.Role) == "admin" && !IsSuperAdminRole(actorRole))
        {
            throw new InvalidOperationException("Only super admins can delete admin accounts.");
        }

        var responderLinks = await db.DoctorSuggestionReplies
            .Where(reply => reply.ResponderDoctorId == doctor.Id)
            .ToListAsync();

        if (responderLinks.Count > 0)
        {
            db.DoctorSuggestionReplies.RemoveRange(responderLinks);
        }

        db.CabinetIdentities.Remove(doctor.CabinetIdentity);

        await db.SaveChangesAsync();
    }

    private DoctorListItemResponse BuildDoctorListItemResponse(Doctor doctor, DateTime now)
    {
        var identity = doctor.CabinetIdentity;
        var subscription = identity?.ActiveSubscriptions;

        var response = new DoctorListItemResponse
        {
            Id = doctor.Id,
            CabinetIdentityId = doctor.CabinetIdentityId,
            Firstname = doctor.Firstname,
            Lastname = doctor.Lastname,
            Email = identity?.Email ?? string.Empty,
            Nationality = doctor.Nationality,
            Role = doctor.Role,
            IsSuperAdmin = IsSuperAdminRole(doctor.Role),
            PhoneNumber = doctor.PhoneNumber,
            Landline = doctor.Landline,
            LanguagePreference = doctor.LanguagePreference,
            CabinetCountry = identity?.Country ?? string.Empty,
            CabinetCity = identity?.City ?? string.Empty,
            CabinetAddress = identity?.Address ?? string.Empty,
            CabinetPostalCode = identity?.PostalCode ?? string.Empty,
            NotesFromAdmin = identity?.AdminNotes,
            ProfilePictureUrl = identity?.ProfilePictureUrl,
            IsCabinetActive = identity?.IsActive ?? false,
            IsFlaggedForDeletion = identity?.IsFlaggedForDeletion ?? false,
            SubscriptionStartDate = subscription?.StartDate,
            SubscriptionEndDate = subscription?.EndDate,
            SubscriptionDurationInMonths = subscription?.DurationInMonths,
            SubscriptionIsActive = subscription?.IsActive ?? false,
            SubscriptionType = subscription?.SubscriptionType ?? string.Empty,
            CreatedAt = doctor.CreatedAt,
        };

        response.Role = NormalizeRole(response.Role);
        PopulateSubscriptionStatus(response, now);
        return response;
    }

    private static void PopulateSubscriptionStatus(DoctorListItemResponse doctor, DateTime now)
    {
        var expiringSoonThreshold = now.AddDays(7);

        if (doctor.IsFlaggedForDeletion)
        {
            doctor.SubscriptionStatus = "deleted";
            doctor.SubscriptionDaysRemaining = null;
            return;
        }

        if (!doctor.IsCabinetActive)
        {
            doctor.SubscriptionStatus = "suspended";
            doctor.SubscriptionDaysRemaining = null;
            return;
        }

        if (doctor.Role == "admin")
        {
            doctor.SubscriptionStatus = "admin";
            doctor.SubscriptionDaysRemaining = null;
            return;
        }

        var endDate = doctor.SubscriptionEndDate;
        var isValidSubscription = doctor.SubscriptionIsActive && endDate.HasValue;
        if (!isValidSubscription)
        {
            doctor.SubscriptionStatus = "expired";
            doctor.SubscriptionDaysRemaining = null;
            return;
        }

        var validEndDate = endDate!.Value;
        doctor.SubscriptionDaysRemaining = (int)Math.Floor((validEndDate - now).TotalDays);

        if (validEndDate <= now)
        {
            doctor.SubscriptionStatus = "expired";
        }
        else if (validEndDate <= expiringSoonThreshold)
        {
            doctor.SubscriptionStatus = "expiring_soon";
        }
        else
        {
            doctor.SubscriptionStatus = "active";
        }
    }

    private static string NormalizeRole(string role)
    {
        var normalizedRole = role.Trim().ToLowerInvariant();
        if (normalizedRole.StartsWith("admin") || normalizedRole.StartsWith("super_admin"))
        {
            return "admin";
        }

        return "doctor";
    }

    private static bool IsSuperAdminRole(string role)
    {
        return role.Trim().ToLowerInvariant().StartsWith("super_admin");
    }

    private static int NormalizeSubscriptionDuration(int? subscriptionDurationInMonths)
    {
        if (!subscriptionDurationInMonths.HasValue || subscriptionDurationInMonths.Value <= 0)
        {
            throw new InvalidOperationException("Subscription duration in months is required and must be greater than 0.");
        }

        if (subscriptionDurationInMonths.Value > 1200)
        {
            throw new InvalidOperationException("Subscription duration in months must be less than or equal to 1200.");
        }

        return subscriptionDurationInMonths.Value;
    }

    private ActiveSubscription EnsureSubscription(Doctor doctor, DateTime now)
    {
        if (doctor.CabinetIdentity == null)
        {
            throw new InvalidOperationException("Cabinet identity not found");
        }

        if (doctor.CabinetIdentity.ActiveSubscriptions != null)
        {
            return doctor.CabinetIdentity.ActiveSubscriptions;
        }

        var subscription = new ActiveSubscription
        {
            CabinetIdentity = doctor.CabinetIdentity,
            StartDate = now,
            EndDate = now.AddMonths(1),
            DurationInMonths = 1,
            IsActive = true,
            SubscriptionType = "trial",
        };

        doctor.CabinetIdentity.ActiveSubscriptions = subscription;
        db.ActiveSubscriptions.Add(subscription);
        return subscription;
    }

    private string GenerateRandomNumericalString(int length = 6)
    {
        const string digits = "0123456789";
        var random = new Random();
        return new string([.. Enumerable.Repeat(digits, length).Select(s => s[random.Next(s.Length)])]);
    }
}
