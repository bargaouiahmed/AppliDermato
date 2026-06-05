using System;
using api.DatabaseRules;
using api.Src.ConsultationSpace.Entities;
using api.Src.PatientSpace.Entities;
using api.Src.Subscription.Entities;
using Microsoft.AspNetCore.Identity;

namespace api.Src.Auth.Entities;

public class CabinetIdentity : BaseEntity
{
    public Guid Id { get; set; }
    public string Country { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string PostalCode { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string CodeCnam { get; set; } = string.Empty;

    public string? ProfilePictureUrl { get; set; }

    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string? RefreshToken { get; set; }
    public DateTime? RefreshTokenExpiresAt { get; set; }

    public bool IsSecondSecretaryActive { get; set; } = false;
    public string? PasswordResetToken { get; set; }
    public DateTime? PasswordResetTokenExpiresAt { get; set; }


    public ICollection<Consultation> Consultations { get; set; } = [];

    public bool IsActive { get; set; } = true;
    public bool IsFlaggedForDeletion { get; set; }
    public DateTime? FlaggedForDeletionAt { get; set; }
    public Doctor? Doctor { get; set; }
    public ICollection<Secretary> Secretaries { get; set; } = [];

    public ActiveSubscription? ActiveSubscriptions { get; set; }
    public string? AdminNotes { get; set; }
    public ICollection<Patient> Patients { get; set; } = [];
    public bool HashAndUpdatePassword(string password)
    {
        if (string.IsNullOrEmpty(password) || password.Length < 8 || !password.Any(char.IsDigit) || !password.Any(char.IsUpper) || !password.Any(char.IsLower) || password.All(char.IsLetterOrDigit)) return false;
        PasswordHash = new PasswordHasher<CabinetIdentity>().HashPassword(this, password);
        UpdatedAt = DateTime.UtcNow;
        return true;
    }
    public bool CompareHash(string password)
    {
        return new PasswordHasher<CabinetIdentity>().VerifyHashedPassword(this, PasswordHash, password) == PasswordVerificationResult.Success;
    }




    public string CreateRefreshToken(int length = 128)
    {
        const string chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        var random = new Random();
        var token = new char[length];
        for (int i = 0; i < length; i++)
        {
            token[i] = chars[random.Next(chars.Length)];
        }
        RefreshToken = new string(token);
        RefreshTokenExpiresAt = PasswordResetTokenExpiresAt = DateTime.UtcNow.AddDays(7);
        UpdatedAt = DateTime.UtcNow;
        return RefreshToken;

    }

    public string GeneratePasswordResetToken(int length = 6)
    {
        const string digits = "0123456789";
        var random = new Random();
        var code = new char[length];
        for (int i = 0; i < length; i++)
        {
            code[i] = digits[random.Next(digits.Length)];
        }
        PasswordResetToken = new string(code);
        PasswordResetTokenExpiresAt = DateTime.UtcNow.AddMinutes(15);
        UpdatedAt = DateTime.UtcNow;
        return PasswordResetToken;
    }






}
