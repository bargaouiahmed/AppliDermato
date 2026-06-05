using System;

namespace api.Src.Admin.Dtos.Responses;

public class DoctorListItemResponse
{
    public Guid Id { get; set; }
    public Guid CabinetIdentityId { get; set; }
    public string Firstname { get; set; } = string.Empty;
    public string Lastname { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Nationality { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public bool IsSuperAdmin { get; set; }
    public string PhoneNumber { get; set; } = string.Empty;
    public string Landline { get; set; } = string.Empty;
    public string LanguagePreference { get; set; } = "fr";
    public string CabinetCountry { get; set; } = string.Empty;
    public string CabinetCity { get; set; } = string.Empty;
    public string CabinetAddress { get; set; } = string.Empty;
    public string CabinetPostalCode { get; set; } = string.Empty;
    public string? NotesFromAdmin { get; set; }
    public string? ProfilePictureUrl { get; set; }
    public bool IsCabinetActive { get; set; }
    public bool IsFlaggedForDeletion { get; set; }
    public DateTime? SubscriptionStartDate { get; set; }
    public DateTime? SubscriptionEndDate { get; set; }
    public int? SubscriptionDurationInMonths { get; set; }
    public bool SubscriptionIsActive { get; set; }
    public string SubscriptionType { get; set; } = string.Empty;
    public string SubscriptionStatus { get; set; } = "expired";
    public int? SubscriptionDaysRemaining { get; set; }
    public DateTime CreatedAt { get; set; }
}