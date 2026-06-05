using System;
using api.Src.Auth.Dtos.Responses;
using api.Src.Auth.Entities;
using api.Src.Profile.Dtos.Requests;
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi.Any;
using Quartz;

namespace api.Src.Profile.Services;

public class ProfileService(
    AppDbContext db,
    ISchedulerFactory schedulerFactory,
    ILogger<ProfileService> logger) : IProfileService
{

    public async Task<DoctorObjectFromClient> UpdateDoctorProfile(DoctorObjectFromClient updatedProfile)
    {
        if (!updatedProfile.Id.HasValue)
        {
            throw new InvalidOperationException("Profile id is required.");
        }

        var doctor = await db.CabinetIdentities.Include(ci => ci.Doctor)
        .ThenInclude(c => c!.Clinics)
        .Include(ci => ci.Doctor)
        .ThenInclude(c => c!.Personalization)
        .Include(ci => ci.Secretaries)
        .FirstOrDefaultAsync(ci => ci.Id == updatedProfile.Id.Value) ?? throw new InvalidOperationException("Doctor not found.");
        var actorRole = doctor.Doctor?.Role ?? string.Empty;
        var isSuperAdmin = string.Equals(actorRole, "super_admin", StringComparison.OrdinalIgnoreCase);
        var superAdminDailyNews = isSuperAdmin
            ? DailyNewsTriplet.FromPersonalization(doctor.Doctor?.Personalization)
            : await GetSuperAdminDailyNewsAsync();
        var autoDailyNewsTurnedOn = false;
        var superAdminDailyNewsManuallyChanged = false;
        var previousSuperAdminDailyNewsFrForPropagation = string.Empty;

        if (updatedProfile.Email != null) doctor.Email = updatedProfile.Email;
        if (updatedProfile.Country != null) doctor.Country = updatedProfile.Country;
        if (updatedProfile.Address != null) doctor.Address = updatedProfile.Address;
        if (updatedProfile.PostalCode != null) doctor.PostalCode = updatedProfile.PostalCode;
        if (updatedProfile.City != null) doctor.City = updatedProfile.City;
        if (updatedProfile.CodeCnam != null) doctor.CodeCnam = updatedProfile.CodeCnam;
        if (updatedProfile.IsSecondSecretaryActive.HasValue) doctor.IsSecondSecretaryActive = updatedProfile.IsSecondSecretaryActive.Value;

        if (doctor.Doctor != null)
        {
            if (updatedProfile.Firstname != null) doctor.Doctor.Firstname = updatedProfile.Firstname;
            if (updatedProfile.Lastname != null) doctor.Doctor.Lastname = updatedProfile.Lastname;
            if (updatedProfile.FirstnameAr != null) doctor.Doctor.FirstnameAr = updatedProfile.FirstnameAr;
            if (updatedProfile.LastnameAr != null) doctor.Doctor.LastnameAr = updatedProfile.LastnameAr;
            if (updatedProfile.Gender != null) doctor.Doctor.Gender = updatedProfile.Gender;
            if (updatedProfile.DateOfBirth.HasValue) doctor.Doctor.DateOfBirth = updatedProfile.DateOfBirth.Value;
            if (updatedProfile.Nationality != null) doctor.Doctor.Nationality = updatedProfile.Nationality;
            if (updatedProfile.PhoneNumber != null) doctor.Doctor.PhoneNumber = updatedProfile.PhoneNumber;
            if (updatedProfile.Landline != null) doctor.Doctor.Landline = updatedProfile.Landline;
            if (updatedProfile.SelfCheckinEnabled.HasValue) doctor.Doctor.SelfCheckinEnabled = updatedProfile.SelfCheckinEnabled.Value;
            if (updatedProfile.SelfCheckinTimeoutSeconds.HasValue)
            {
                var timeout = Math.Clamp(updatedProfile.SelfCheckinTimeoutSeconds.Value, 30, 3600);
                doctor.Doctor.SelfCheckinTimeoutSeconds = timeout;
            }

            if (updatedProfile.Personalization != null)
            {
                var personalization = doctor.Doctor.Personalization;
                if (personalization == null)
                {
                    personalization = new DoctorPersonalization
                    {
                        DoctorId = doctor.Doctor.Id,
                    };
                    doctor.Doctor.Personalization = personalization;
                    db.DoctorPersonalizations.Add(personalization);
                }

                if (!string.IsNullOrWhiteSpace(updatedProfile.Personalization.CylinderScale))
                {
                    var value = updatedProfile.Personalization.CylinderScale.Trim().ToLowerInvariant();
                    personalization.CylinderScale = value is "negatif" or "positif" or "mixte" ? value : personalization.CylinderScale;
                }

                if (!string.IsNullOrWhiteSpace(updatedProfile.Personalization.DistanceVisualScale))
                {
                    var value = updatedProfile.Personalization.DistanceVisualScale.Trim().ToLowerInvariant();
                    personalization.DistanceVisualScale = value is "snellen" or "monoyer" ? value : personalization.DistanceVisualScale;
                }

                if (updatedProfile.Personalization.WaitingRoomMessage != null)
                    personalization.WaitingRoomMessage = updatedProfile.Personalization.WaitingRoomMessage;

                if (updatedProfile.Personalization.DailyNewsSet == true)
                {
                    var requestedDailyNewsFr = NormalizeNullable(updatedProfile.Personalization.DailyNewsFr
                        ?? updatedProfile.Personalization.DailyNews);
                    var requestedDailyNewsEn = NormalizeNullable(updatedProfile.Personalization.DailyNewsEn)
                        ?? requestedDailyNewsFr;
                    var requestedDailyNewsAr = NormalizeNullable(updatedProfile.Personalization.DailyNewsAr)
                        ?? requestedDailyNewsFr;
                    if (isSuperAdmin)
                    {
                        var currentTriplet = DailyNewsTriplet.FromPersonalization(personalization);
                        var autoDailyNewsEnabledAfterUpdate =
                            updatedProfile.Personalization.AutoDailyNewsEnabled
                            ?? personalization.AutoDailyNewsEnabled;
                        if (autoDailyNewsEnabledAfterUpdate)
                        {
                            var currentDailyNews = NormalizeNullable(personalization.DailyNewsFr ?? personalization.DailyNews);
                            if (!string.Equals(requestedDailyNewsFr, currentDailyNews, StringComparison.Ordinal))
                            {
                                throw new InvalidOperationException("Auto actualité IA est activée. Désactivez-la pour modifier l'actualité manuellement.");
                            }
                        }

                        personalization.DailyNewsFr = requestedDailyNewsFr;
                        personalization.DailyNewsEn = requestedDailyNewsEn;
                        personalization.DailyNewsAr = requestedDailyNewsAr;
                        personalization.DailyNews = requestedDailyNewsFr;
                        personalization.UseSuperAdminDailyNews = false;

                        superAdminDailyNewsManuallyChanged =
                            !string.Equals(requestedDailyNewsFr, currentTriplet.Fr, StringComparison.Ordinal) ||
                            !string.Equals(requestedDailyNewsEn, currentTriplet.En, StringComparison.Ordinal) ||
                            !string.Equals(requestedDailyNewsAr, currentTriplet.Ar, StringComparison.Ordinal);
                        if (superAdminDailyNewsManuallyChanged)
                        {
                            previousSuperAdminDailyNewsFrForPropagation = currentTriplet.Fr ?? string.Empty;
                        }
                    }
                    else
                    {
                        var sameAsSuperAdmin =
                            string.Equals(requestedDailyNewsFr, superAdminDailyNews.Fr, StringComparison.Ordinal) &&
                            string.Equals(requestedDailyNewsEn, superAdminDailyNews.En, StringComparison.Ordinal) &&
                            string.Equals(requestedDailyNewsAr, superAdminDailyNews.Ar, StringComparison.Ordinal);
                        personalization.UseSuperAdminDailyNews = sameAsSuperAdmin;
                        if (!sameAsSuperAdmin)
                        {
                            personalization.DailyNewsFr = requestedDailyNewsFr;
                            personalization.DailyNewsEn = requestedDailyNewsEn;
                            personalization.DailyNewsAr = requestedDailyNewsAr;
                            personalization.DailyNews = requestedDailyNewsFr;
                        }
                    }
                }

                var wasAutoDailyNewsEnabled = personalization.AutoDailyNewsEnabled;
                if (updatedProfile.Personalization.AutoDailyNewsEnabled.HasValue && isSuperAdmin)
                {
                    personalization.AutoDailyNewsEnabled = updatedProfile.Personalization.AutoDailyNewsEnabled.Value;
                }
                autoDailyNewsTurnedOn = isSuperAdmin &&
                    !wasAutoDailyNewsEnabled &&
                    personalization.AutoDailyNewsEnabled;

                if (updatedProfile.Personalization.ShowHeader.HasValue)
                    personalization.ShowHeader = updatedProfile.Personalization.ShowHeader.Value;
                if (updatedProfile.Personalization.ShowFirstName.HasValue)
                    personalization.ShowFirstName = updatedProfile.Personalization.ShowFirstName.Value;
                if (updatedProfile.Personalization.ShowLastName.HasValue)
                    personalization.ShowLastName = updatedProfile.Personalization.ShowLastName.Value;
                if (updatedProfile.Personalization.ShowCodeCnam.HasValue)
                    personalization.ShowCodeCnam = updatedProfile.Personalization.ShowCodeCnam.Value;
                if (updatedProfile.Personalization.ShowFirstNameArabic.HasValue)
                    personalization.ShowFirstNameArabic = updatedProfile.Personalization.ShowFirstNameArabic.Value;
                if (updatedProfile.Personalization.ShowLastNameArabic.HasValue)
                    personalization.ShowLastNameArabic = updatedProfile.Personalization.ShowLastNameArabic.Value;

                if (updatedProfile.Personalization.ShowFooter.HasValue)
                    personalization.ShowFooter = updatedProfile.Personalization.ShowFooter.Value;
                if (updatedProfile.Personalization.ShowFooterCabinetAddress.HasValue)
                    personalization.ShowFooterCabinetAddress = updatedProfile.Personalization.ShowFooterCabinetAddress.Value;
                if (updatedProfile.Personalization.ShowFooterLandline.HasValue)
                    personalization.ShowFooterLandline = updatedProfile.Personalization.ShowFooterLandline.Value;
                if (updatedProfile.Personalization.ShowFooterMobile.HasValue)
                    personalization.ShowFooterMobile = updatedProfile.Personalization.ShowFooterMobile.Value;
                if (updatedProfile.Personalization.ShowFooterEmail.HasValue)
                    personalization.ShowFooterEmail = updatedProfile.Personalization.ShowFooterEmail.Value;
            }

            if (updatedProfile.ClearClinics == true)
            {
                db.RemoveRange(doctor.Doctor.Clinics);
            }
            else if (updatedProfile.Clinics != null)
            {
                db.RemoveRange(doctor.Doctor.Clinics);
                foreach (var clinic in updatedProfile.Clinics)
                {
                    doctor.Doctor.Clinics.Add(new Clinic
                    {
                        Name = clinic.Name ?? string.Empty,
                        Address = clinic.Address ?? string.Empty,
                        PhoneNumber = clinic.PhoneNumber ?? string.Empty,
                        GoogleMapsLink = clinic.GoogleMapsLink ?? string.Empty
                    });
                }
            }
        }

        var secretaryUpdateRequested =
            updatedProfile.Secretaries != null ||
            updatedProfile.ClearFirstSecretary.HasValue ||
            updatedProfile.ClearSecondSecretary.HasValue;

        if (secretaryUpdateRequested)
        {
            var existingSecretaries = doctor.Secretaries.ToList();
            db.RemoveRange(existingSecretaries);
            doctor.Secretaries.Clear();

            var incomingSecretaries = (updatedProfile.Secretaries ?? new List<SecDtoWithoutId>())
                .Select((sec, index) => new
                {
                    Slot = NormalizeSecretarySlot(sec.Index, index),
                    Firstname = sec.Firstname?.Trim() ?? string.Empty,
                    Lastname = sec.Lastname?.Trim() ?? string.Empty,
                })
                .Where(sec => sec.Slot is 1 or 2)
                .GroupBy(sec => sec.Slot)
                .Select(group => group.Last());

            foreach (var sec in incomingSecretaries)
            {
                if (sec.Slot == 1 && updatedProfile.ClearFirstSecretary == true) continue;
                if (sec.Slot == 2 && (updatedProfile.ClearSecondSecretary == true || !doctor.IsSecondSecretaryActive)) continue;
                if (string.IsNullOrWhiteSpace(sec.Firstname) || string.IsNullOrWhiteSpace(sec.Lastname)) continue;

                doctor.Secretaries.Add(new Secretary
                {
                    Firstname = sec.Firstname,
                    Lastname = sec.Lastname,
                    SecretaryIndex = sec.Slot
                });
            }
        }

        if (updatedProfile.Pfp != null)
        {
            doctor.ProfilePictureUrl = await SaveProfilePictureToFs(updatedProfile.Pfp, doctor.Id);
        }


        await db.SaveChangesAsync();
        if (autoDailyNewsTurnedOn)
        {
            _ = QueueImmediateAutoDailyNewsRefreshAsync();
        }
        else if (isSuperAdmin && superAdminDailyNewsManuallyChanged)
        {
            _ = QueueImmediateDailyNewsPropagationAsync(previousSuperAdminDailyNewsFrForPropagation);
        }
        var personalizationResult = doctor.Doctor?.Personalization;
        var shouldUseSuperAdminDailyNews = !isSuperAdmin && (personalizationResult?.UseSuperAdminDailyNews ?? true);
        var effectiveDailyNews = shouldUseSuperAdminDailyNews
            ? superAdminDailyNews
            : DailyNewsTriplet.FromPersonalization(personalizationResult);
        return new DoctorObjectFromClient
        {
            Id = doctor.Id,
            DoctorId = doctor.Doctor?.Id,
            Firstname = doctor.Doctor?.Firstname,
            Lastname = doctor.Doctor?.Lastname,
            Role = doctor.Doctor?.Role,
            Email = doctor.Email,
            FirstnameAr = doctor.Doctor?.FirstnameAr,
            LastnameAr = doctor.Doctor?.LastnameAr,
            Country = doctor.Country,
            Address = doctor.Address,
            PostalCode = doctor.PostalCode,
            City = doctor.City,
            CodeCnam = doctor.CodeCnam,
            Pfp = null,
            ProfilePictureUrl = doctor.ProfilePictureUrl,
            Gender = doctor.Doctor?.Gender,
            DateOfBirth = doctor.Doctor?.DateOfBirth,
            Nationality = doctor.Doctor?.Nationality,
            PhoneNumber = doctor.Doctor?.PhoneNumber,
            Landline = doctor.Doctor?.Landline,
            Secretaries = doctor.Secretaries
                .OrderBy(s => s.SecretaryIndex)
                .Select(s => new SecDtoWithoutId(s.Firstname, s.Lastname, s.SecretaryIndex))
                .ToList(),
            IsSecondSecretaryActive = doctor.IsSecondSecretaryActive,
            SelfCheckinEnabled = doctor.Doctor?.SelfCheckinEnabled,
            SelfCheckinKey = doctor.Doctor?.SelfCheckinKey,
            SelfCheckinTimeoutSeconds = doctor.Doctor?.SelfCheckinTimeoutSeconds,
            Clinics = doctor.Doctor?.Clinics
                .Select(c => new SerializedClinicWithoutId(c.Name, c.Address, c.PhoneNumber, c.GoogleMapsLink))
                .ToList() ?? [],
            Personalization = new DoctorPersonalizationObjectFromClient
            {
                CylinderScale = personalizationResult?.CylinderScale ?? "negatif",
                DistanceVisualScale = personalizationResult?.DistanceVisualScale ?? "snellen",
                WaitingRoomMessage = personalizationResult?.WaitingRoomMessage ?? string.Empty,
                DailyNews = effectiveDailyNews.Fr ?? string.Empty,
                DailyNewsFr = effectiveDailyNews.Fr ?? string.Empty,
                DailyNewsEn = effectiveDailyNews.En ?? string.Empty,
                DailyNewsAr = effectiveDailyNews.Ar ?? string.Empty,
                UseSuperAdminDailyNews = shouldUseSuperAdminDailyNews,
                AutoDailyNewsEnabled = personalizationResult?.AutoDailyNewsEnabled ?? false,
                ShowHeader = personalizationResult?.ShowHeader ?? true,
                ShowFirstName = personalizationResult?.ShowFirstName ?? true,
                ShowLastName = personalizationResult?.ShowLastName ?? true,
                ShowCodeCnam = personalizationResult?.ShowCodeCnam ?? true,
                ShowFirstNameArabic = personalizationResult?.ShowFirstNameArabic ?? false,
                ShowLastNameArabic = personalizationResult?.ShowLastNameArabic ?? false,
                ShowFooter = personalizationResult?.ShowFooter ?? true,
                ShowFooterCabinetAddress = personalizationResult?.ShowFooterCabinetAddress ?? true,
                ShowFooterLandline = personalizationResult?.ShowFooterLandline ?? true,
                ShowFooterMobile = personalizationResult?.ShowFooterMobile ?? true,
                ShowFooterEmail = personalizationResult?.ShowFooterEmail ?? true,
            }
        };

    }

    private static int NormalizeSecretarySlot(int? value, int fallbackIndex)
    {
        return value switch
        {
            1 or 2 => value.Value,
            0 => 1,
            _ => fallbackIndex + 1
        };
    }

    private async Task<string> SaveProfilePictureToFs(IFormFile pfp, Guid CabinetIdentityId)
    {
        var fileExtension = Path.GetExtension(pfp.FileName);
        if (!IsValidImageExtension(fileExtension))
        {
            throw new InvalidOperationException("Invalid file type. Only .jpg, .jpeg, .png, .webp, and .svg are allowed.");
        }
        if (!IsValidSize(pfp))
        {
            throw new InvalidOperationException("File size exceeds the 5MB limit.");
        }
        var fileName = $"{Guid.NewGuid()}{fileExtension}";
        var filePath = Path.Combine("wwwroot", "profile_pictures", fileName);
        if (!Directory.Exists(Path.Combine("wwwroot", "profile_pictures")))
        {
            Directory.CreateDirectory(Path.Combine("wwwroot", "profile_pictures"));
        }
        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await pfp.CopyToAsync(stream);
        }
        var profilePictureUrl = $"/profile_pictures/{fileName}";
        return profilePictureUrl;
    }
    public async Task UpdateDoctorPassword(Guid doctorIdentityId, UpdateDoctorPasswordRequest request)
    {
        var doctorIdentity = await db.CabinetIdentities
        .FirstOrDefaultAsync(ci => ci.Id == doctorIdentityId ) ?? throw new InvalidOperationException("Doctor not found.");

 

        if (!doctorIdentity.CompareHash(request.OldPassword))
        {
            throw new InvalidOperationException("Old password is incorrect.");
        }

        doctorIdentity.HashAndUpdatePassword(request.NewPassword);
        await db.SaveChangesAsync();
    }
    private bool IsValidImageExtension(string extension)
    {
        var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".webp", ".svg" };
        return allowedExtensions.Contains(extension.ToLower());
    }
    private bool IsValidSize(IFormFile file)
    {
        const long maxSizeInBytes = 5 * 1024 * 1024; // 5MB
        return file.Length <= maxSizeInBytes;
    }

    private async Task<DailyNewsTriplet> GetSuperAdminDailyNewsAsync()
    {
        var dailyNews = await db.Doctors
            .AsNoTracking()
            .Where(d => d.Role == "super_admin")
            .Select(d => d.Personalization)
            .FirstOrDefaultAsync();
        return DailyNewsTriplet.FromPersonalization(dailyNews);
    }

    private sealed record DailyNewsTriplet(string? Fr, string? En, string? Ar)
    {
        public static DailyNewsTriplet FromPersonalization(DoctorPersonalization? personalization)
        {
            var fr = Pick(personalization?.DailyNewsFr, personalization?.DailyNews, null);
            var en = Pick(personalization?.DailyNewsEn, fr, fr);
            var ar = Pick(personalization?.DailyNewsAr, fr, fr);
            return new DailyNewsTriplet(fr, en, ar);
        }

        private static string? Pick(string? preferred, string? fallback, string? finalFallback)
        {
            var value = NormalizeNullable(preferred);
            if (!string.IsNullOrWhiteSpace(value))
            {
                return value;
            }

            value = NormalizeNullable(fallback);
            if (!string.IsNullOrWhiteSpace(value))
            {
                return value;
            }

            return finalFallback;
        }
    }

    private static string? NormalizeNullable(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        return value.Trim();
    }

    private async Task QueueImmediateAutoDailyNewsRefreshAsync()
    {
        try
        {
            var scheduler = await schedulerFactory.GetScheduler();
            await scheduler.TriggerJob(new JobKey("SuperAdminDailyNewsGenerationJob"));

            var propagationTrigger = TriggerBuilder.Create()
                .ForJob(new JobKey("SuperAdminDailyNewsPropagationJob"))
                .WithIdentity($"SuperAdminDailyNewsPropagationJob-manual-{Guid.NewGuid():N}")
                .StartAt(DateBuilder.FutureDate(20, IntervalUnit.Second))
                .Build();

            await scheduler.ScheduleJob(propagationTrigger);
            logger.LogInformation("[AUTO_DAILY_NEWS] immediate_jobs_enqueued");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[AUTO_DAILY_NEWS] immediate_job_enqueue_failed");
        }
    }

    private async Task QueueImmediateDailyNewsPropagationAsync(string? previousSourceFr)
    {
        try
        {
            var scheduler = await schedulerFactory.GetScheduler();
            var jobData = new JobDataMap
            {
                { "PreviousSourceFr", previousSourceFr ?? string.Empty }
            };
            await scheduler.TriggerJob(new JobKey("SuperAdminDailyNewsPropagationJob"), jobData);
            logger.LogInformation("[AUTO_DAILY_NEWS] immediate_propagation_enqueued");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[AUTO_DAILY_NEWS] immediate_propagation_enqueue_failed");
        }
    }


}
