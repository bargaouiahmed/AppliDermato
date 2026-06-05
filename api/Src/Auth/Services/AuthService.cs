using System;
using System.Globalization;
using System.Security.Cryptography;
using System.Security.Claims;
using api.Src.Auth.Dtos;
using api.Src.Auth.Dtos.Requests;
using api.Src.Auth.Dtos.Responses;
using api.Src.Auth.Entities;
using api.Src.Smtp.Services;
using api.Src.Subscription.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace api.Src.Auth.Services.Auth;

public class AuthService(AppDbContext db, ISmtpService smtp) : IAuthService
{
    public async Task EnsureSuperAdminExists()
    {
        string superAdminEmail = Environment.GetEnvironmentVariable("admin_email") ?? throw new Exception("admin_email environment variable is not set");
        string superAdminPassword = Environment.GetEnvironmentVariable("admin_password") ?? throw new Exception("admin_password environment variable is not set");

        if (!await db.CabinetIdentities.AnyAsync(c => c.Email == superAdminEmail))
        {
            var superAdminIdentity = new CabinetIdentity
            {
                Email = superAdminEmail,

            };
            if (!superAdminIdentity.HashAndUpdatePassword(superAdminPassword))
            {
                throw new Exception("Failed to hash super admin password");
            }
            var superAdmin = new Doctor
            {
                Firstname = "Super",
                Lastname = "Admin",
                Role = "super_admin",
                CabinetIdentity = superAdminIdentity
            };
            var AdminCabinetSubscription = new ActiveSubscription
            {
                IsActive = true,
                StartDate = DateTime.UtcNow,
                EndDate = DateTime.UtcNow.AddYears(1000),
                CabinetIdentity = superAdminIdentity
            };
            db.ActiveSubscriptions.Add(AdminCabinetSubscription);
            db.Doctors.Add(superAdmin);
            await db.SaveChangesAsync();
        }
    }
    public async Task<TokenPairResponse> SignIn(SignInRequestWithRole request)
    {
        var normalizedRole = request.Role.Trim().ToLowerInvariant();

        if (normalizedRole == "doctor")
        {
            var doctor = await db.CabinetIdentities.Include(c => c.Doctor).FirstOrDefaultAsync(c => c.Email == request.Email) ?? throw new InvalidOperationException("Doctor not found");
            if (!doctor.IsActive) throw new InvalidOperationException("Inactive account, please contact support");
            if (doctor.IsFlaggedForDeletion && doctor.FlaggedForDeletionAt.HasValue)
            {
                var deletionEndDate = doctor.FlaggedForDeletionAt.Value.AddDays(90).ToString("dd/MM/yyyy");
                throw new InvalidOperationException($"Account deleted, please contact support to restore it before {deletionEndDate}");
            }

            if (!doctor.CompareHash(request.Password)) throw new InvalidOperationException("Invalid credentials");

            if (doctor.RefreshToken == null || doctor.RefreshTokenExpiresAt < DateTime.UtcNow)
            {
                doctor.CreateRefreshToken();
                await db.SaveChangesAsync();
            }
            string refreshToken = doctor.RefreshToken!;

            return new TokenPairResponse
            {
                AccessToken = GenerateJwtToken(doctor.Id, doctor.Email, doctor.Doctor!.Role, "doctor", doctor.Doctor.Id),
                RefreshToken = refreshToken,
                IdentityId = doctor.Id,
                Role = doctor.Doctor.Role,
                ProfileId = doctor.Doctor.Id

            };
        }
        var requestedSecretarySlot = normalizedRole switch
        {
            "secretary1" => 1,
            "secretary2" => 2,
            "secretaire1" => 1,
            "secretaire2" => 2,
            _ => 0
        };

        if (requestedSecretarySlot == 0) throw new InvalidOperationException("Invalid Role");

        var cabinetIncludeSec = await db.CabinetIdentities.Include(c => c.Secretaries).FirstOrDefaultAsync(c => c.Email == request.Email) ?? throw new InvalidOperationException("Doctor does not exist");
        if (!cabinetIncludeSec.IsActive) throw new InvalidOperationException("Inactive account, please contact support");
        if (cabinetIncludeSec.IsFlaggedForDeletion && cabinetIncludeSec.FlaggedForDeletionAt.HasValue)
        {
            var deletionEndDate = cabinetIncludeSec.FlaggedForDeletionAt.Value.AddDays(90).ToString("dd/MM/yyyy");
            throw new InvalidOperationException($"Account deleted, please contact support to restore it before {deletionEndDate}");
        }

        if (!cabinetIncludeSec.CompareHash(request.Password)) throw new InvalidOperationException("Invalid credentials");

        if (cabinetIncludeSec.Secretaries == null || cabinetIncludeSec.Secretaries.Count == 0)
            throw new InvalidOperationException("Trying to log in as a secretary for a doctor without secretaries");

        else
        {
            var orderedSecretaries = cabinetIncludeSec.Secretaries
                .OrderBy(sec => sec.SecretaryIndex)
                .ThenBy(sec => sec.CreatedAt)
                .ToList();

            var secretary = orderedSecretaries.FirstOrDefault(sec => sec.SecretaryIndex == requestedSecretarySlot)
                ?? orderedSecretaries.ElementAtOrDefault(requestedSecretarySlot - 1)
                ?? throw new InvalidOperationException("Selected secretary does not exist");

            if (requestedSecretarySlot == 2 && !cabinetIncludeSec.IsSecondSecretaryActive)
            {
                throw new InvalidOperationException("Second secretary is not active.");
            }

            if (cabinetIncludeSec.RefreshToken == null)
            {
                cabinetIncludeSec.CreateRefreshToken();
                await db.SaveChangesAsync();
            }
            string refreshToken = cabinetIncludeSec.RefreshToken!;
            var profileRole = requestedSecretarySlot == 2 ? "secretary2" : "secretary1";
            return new TokenPairResponse
            {
                AccessToken = GenerateJwtToken(cabinetIncludeSec.Id, cabinetIncludeSec.Email, "secretary", profileRole, secretary.Id),
                RefreshToken = refreshToken,
                IdentityId = cabinetIncludeSec.Id,
                Role = "secretary",
                ProfileId = secretary.Id
            };
        }
    }

    public async Task<LoginOptionsResponse> GetAccountsForCabinet(SignInRequest request)
    {
        var identity = await db.CabinetIdentities.Include(c => c.Doctor).Include(c => c.Secretaries).FirstOrDefaultAsync(c => c.Email == request.Email) ?? throw new InvalidOperationException("Invalid email");
        if (!identity.IsActive) throw new InvalidOperationException("Inactive account, please contact support");
        if (identity.IsFlaggedForDeletion && identity.FlaggedForDeletionAt.HasValue)
        {
            var deletionEndDate = identity.FlaggedForDeletionAt.Value.AddDays(90).ToString("dd/MM/yyyy");
            throw new InvalidOperationException($"Account deleted, please contact support to restore it before {deletionEndDate}");
        }
        if (!identity.CompareHash(request.Password)) throw new InvalidOperationException("Invalid credentials");

        if (identity.Secretaries == null) return new LoginOptionsResponse { DoctorFirstname = identity.Doctor!.Firstname, DoctorLastname = identity.Doctor!.Lastname, IsSecondSecretaryActive = false };
        return new LoginOptionsResponse
        {
            DoctorFirstname = identity.Doctor!.Firstname,
            DoctorLastname = identity.Doctor!.Lastname,
            IsSecondSecretaryActive = identity.IsSecondSecretaryActive,
            Secretaries = identity.Secretaries.Select(s => new SecDto(s.Firstname, s.Lastname, s.Id, s.SecretaryIndex)).ToList()
        };
    }

    public async Task<TokenPairResponse> RefreshToken(string refreshToken, Guid id, string role)
    {
        var identity = await db.CabinetIdentities.FirstOrDefaultAsync(c => c.Id == id && c.RefreshToken == refreshToken && c.RefreshTokenExpiresAt >= DateTime.UtcNow) ?? throw new InvalidOperationException("Invalid refresh token or id");
        return new TokenPairResponse
        {
            AccessToken = GenerateJwtToken(id, identity.Email, role),
            RefreshToken = identity.RefreshToken!
        };
    }



    public async Task SendPasswordResetEmail(string email, string languagePreference = "fr")
    {
        var identity = await db.CabinetIdentities.Include(c => c.Doctor).FirstOrDefaultAsync(c => c.Email == email) ?? throw new InvalidOperationException("Invalid email");
        string token = identity.GeneratePasswordResetToken();
        await smtp.SendPasswordResetEmailAsync(email, token, identity.Doctor!.Firstname, identity.Doctor.Lastname, languagePreference);
        await db.SaveChangesAsync();
    }
    public async Task ResetPassword(ResetPasswordRequest request)
    {
        var identity = await db.CabinetIdentities.FirstOrDefaultAsync(c => c.Email == request.Email && c.PasswordResetToken == request.ResetToken && c.PasswordResetTokenExpiresAt >= DateTime.UtcNow) ?? throw new InvalidOperationException("Invalid Email");

        if (!identity.HashAndUpdatePassword(request.NewPassword)) throw new InvalidOperationException("Password must contain at least 8 characters, 1 digit, 1 symbol, 1 lowercase and 1 uppercase");
        await db.SaveChangesAsync();
    }

    public async Task<TokenPairResponse> ChangeAutoAssignedPassword(Guid cabinetIdentityId, ChangeAutoAssignedPasswordRequest request)
    {
        var identity = await db.CabinetIdentities.Include(i => i.Doctor).FirstOrDefaultAsync(c => c.Id == cabinetIdentityId) ?? throw new InvalidOperationException("Identity not found");
        if (identity.Doctor == null) throw new InvalidOperationException("No doctor profile associated with this account");
        if (!identity.IsActive) throw new InvalidOperationException("Inactive account, please contact support");
        if (identity.IsFlaggedForDeletion && identity.FlaggedForDeletionAt.HasValue)
        {
            var deletionEndDate = identity.FlaggedForDeletionAt.Value.AddDays(90).ToString("dd/MM/yyyy");
            throw new InvalidOperationException($"Account deleted, please contact support to restore it before {deletionEndDate}");
        }
        if (identity.Doctor.Role.Contains("auto_pass_unchanged"))
        {
            if (!identity.CompareHash(request.OldPassword)) throw new InvalidOperationException("Old password is incorrect");
            if (!identity.HashAndUpdatePassword(request.NewPassword)) throw new InvalidOperationException("Password must contain at least 8 characters, 1 digit, 1 symbol, 1 lowercase and 1 uppercase");
            identity.Doctor.Role = identity.Doctor.Role.Replace("_auto_pass_unchanged", "");
            if (string.IsNullOrEmpty(identity.RefreshToken) || identity.RefreshTokenExpiresAt < DateTime.UtcNow)
            {
                identity.CreateRefreshToken();
            }
            await db.SaveChangesAsync();
            return new TokenPairResponse
            {
                AccessToken = GenerateJwtToken(identity.Id, identity.Email, identity.Doctor.Role),
                RefreshToken = identity.RefreshToken!,
                IdentityId = identity.Id,
                Role = identity.Doctor.Role,
                ProfileId = identity.Doctor.Id
            };

        }
        else
        {
            throw new InvalidOperationException("This account's password has already been changed from the auto-assigned one, cannot change it again using this endpoint");
        }
    }

























    public string GenerateJwtToken(Guid cabinetId, string email, string role, string? profileRole = null, Guid? profileId = null)
    {
        var secretKey = Environment.GetEnvironmentVariable("jwt_secret_key") ?? throw new InvalidOperationException("jwt_secret_key not found in environment variables.");
        var issuer = Environment.GetEnvironmentVariable("jwt_issuer") ?? throw new InvalidOperationException("jwt_issuer not found in environment variables.");
        var audience = Environment.GetEnvironmentVariable("jwt_audience") ?? throw new InvalidOperationException("jwt_audience not found in environment variables.");

        var tokenHandler = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler();
        var key = System.Text.Encoding.ASCII.GetBytes(secretKey);
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, cabinetId.ToString()),
            new(ClaimTypes.Email, email),
            new(ClaimTypes.Role, role)
        };

        if (!string.IsNullOrWhiteSpace(profileRole))
        {
            claims.Add(new Claim("profile_role", profileRole));
        }

        if (profileId.HasValue)
        {
            claims.Add(new Claim("profile_id", profileId.Value.ToString()));
        }

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = DateTime.UtcNow.AddDays(60),
            Issuer = issuer,
            Audience = audience,
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
        };
        var token = tokenHandler.CreateToken(tokenDescriptor);
        return tokenHandler.WriteToken(token);
    }





    public async Task<SerializedDoctorProfile> GetAuthenticatedDoctorAccount(Guid identityId, string role)
    {
        var identity = await db.CabinetIdentities
            .Include(c => c.Secretaries)
            .Include(c => c.Doctor)
            .ThenInclude(d => d!.Clinics)
            .Include(c => c.Doctor)
            .ThenInclude(d => d!.Personalization)
            .FirstOrDefaultAsync(c => c.Id == identityId)
            ?? throw new InvalidOperationException("Identity not found");
        if (identity.Doctor == null) throw new InvalidOperationException("No doctor profile associated with this account");
        var doctor = identity.Doctor;
        var personalization = doctor.Personalization;
        var isSuperAdmin = string.Equals(doctor.Role, "super_admin", StringComparison.OrdinalIgnoreCase);
        var superAdminDailyNews = isSuperAdmin
            ? DailyNewsTriplet.FromPersonalization(personalization)
            : await GetSuperAdminDailyNewsAsync();
        var shouldUseSuperAdminDailyNews = !isSuperAdmin && (personalization?.UseSuperAdminDailyNews ?? true);
        var effectiveDailyNews = shouldUseSuperAdminDailyNews
            ? superAdminDailyNews
            : DailyNewsTriplet.FromPersonalization(personalization);

        var shouldSave = false;
        if (string.IsNullOrWhiteSpace(doctor.SelfCheckinKey))
        {
            doctor.SelfCheckinKey = GenerateSelfCheckinKey();
            shouldSave = true;
        }

        if (doctor.SelfCheckinTimeoutSeconds < 30 || doctor.SelfCheckinTimeoutSeconds > 3600)
        {
            doctor.SelfCheckinTimeoutSeconds = 90;
            shouldSave = true;
        }

        if (shouldSave)
        {
            await db.SaveChangesAsync();
        }

        return new SerializedDoctorProfile
        {
            Id = identity.Id,
            DoctorId = doctor.Id,
            Email = identity.Email,
            Role = role == "secretary" ? role : doctor.Role,
            Firstname = doctor.Firstname,
            Lastname = doctor.Lastname,
            FirstnameAr = doctor.FirstnameAr,
            LastnameAr = doctor.LastnameAr,
            ProfilePictureUrl = identity.ProfilePictureUrl,
            Gender = doctor.Gender,
            DateOfBirth = doctor.DateOfBirth,
            Nationality = doctor.Nationality,
            PhoneNumber = doctor.PhoneNumber,
            Landline = doctor.Landline,
            Address = identity.Address,
            City = identity.City,
            Country = identity.Country,
            CodeCnam = identity.CodeCnam,
            SelfCheckinEnabled = doctor.SelfCheckinEnabled,
            SelfCheckinKey = doctor.SelfCheckinKey ?? string.Empty,
            SelfCheckinTimeoutSeconds = doctor.SelfCheckinTimeoutSeconds,

            IsSecondSecretaryActive = identity.IsSecondSecretaryActive,
            Secretaries = identity.Secretaries?.Select(s => new SecDto(s.Firstname, s.Lastname, s.Id, s.SecretaryIndex)).ToList() ?? [],
            Clinics = doctor.Clinics?.Select(cl => new SerializedClinic(cl.Id, cl.Name, cl.Address, cl.PhoneNumber, cl.GoogleMapsLink)).ToList() ?? [],
            Personalization = new SerializedDoctorPersonalization
            {
                CylinderScale = personalization?.CylinderScale ?? "negatif",
                DistanceVisualScale = personalization?.DistanceVisualScale ?? "snellen",
                WaitingRoomMessage = personalization?.WaitingRoomMessage ?? string.Empty,
                DailyNews = effectiveDailyNews.Fr,
                DailyNewsFr = effectiveDailyNews.Fr,
                DailyNewsEn = effectiveDailyNews.En,
                DailyNewsAr = effectiveDailyNews.Ar,
                UseSuperAdminDailyNews = shouldUseSuperAdminDailyNews,
                AutoDailyNewsEnabled = personalization?.AutoDailyNewsEnabled ?? false,
                ShowHeader = personalization?.ShowHeader ?? true,
                ShowFirstName = personalization?.ShowFirstName ?? true,
                ShowLastName = personalization?.ShowLastName ?? true,
                ShowCodeCnam = personalization?.ShowCodeCnam ?? true,
                ShowFirstNameArabic = personalization?.ShowFirstNameArabic ?? false,
                ShowLastNameArabic = personalization?.ShowLastNameArabic ?? false,
                ShowFooter = personalization?.ShowFooter ?? true,
                ShowFooterCabinetAddress = personalization?.ShowFooterCabinetAddress ?? true,
                ShowFooterLandline = personalization?.ShowFooterLandline ?? true,
                ShowFooterMobile = personalization?.ShowFooterMobile ?? true,
                ShowFooterEmail = personalization?.ShowFooterEmail ?? true,
            }

        };
    }

    private static string GenerateSelfCheckinKey()
    {
        Span<byte> buffer = stackalloc byte[24];
        RandomNumberGenerator.Fill(buffer);
        return Convert.ToHexString(buffer).ToLowerInvariant();
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

    private sealed record DailyNewsTriplet(string Fr, string En, string Ar)
    {
        public static DailyNewsTriplet FromPersonalization(DoctorPersonalization? personalization)
        {
            var fr = Pick(personalization?.DailyNewsFr, personalization?.DailyNews, string.Empty);
            var en = Pick(personalization?.DailyNewsEn, fr, fr);
            var ar = Pick(personalization?.DailyNewsAr, fr, fr);
            return new DailyNewsTriplet(fr, en, ar);
        }

        private static string Pick(string? preferred, string? fallback, string finalFallback)
        {
            var value = preferred?.Trim();
            if (!string.IsNullOrWhiteSpace(value))
            {
                return value;
            }

            value = fallback?.Trim();
            if (!string.IsNullOrWhiteSpace(value))
            {
                return value;
            }

            return finalFallback;
        }
    }


}
