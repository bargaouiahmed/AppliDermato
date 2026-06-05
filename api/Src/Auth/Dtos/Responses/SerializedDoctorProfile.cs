using System;

namespace api.Src.Auth.Dtos.Responses;

public class SerializedDoctorProfile
{
    public Guid Id { get; set; }
    public Guid DoctorId { get; set; }
    public required string Firstname { get; set; }
    public required string Lastname { get; set; }
    public required string Email { get; set; }
    public required string Role { get; set; }

    public string FirstnameAr { get; set; } = string.Empty;
    public string LastnameAr { get; set; } = string.Empty;

    public string? ProfilePictureUrl { get; set; }
    public string Gender { get; set; } = string.Empty;
    public DateTime DateOfBirth { get; set; }
    public string Nationality { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public string Landline { get; set; } = string.Empty;
    public List<SecDto> Secretaries { get; set; } = [];
    public bool IsSecondSecretaryActive { get; set; }
    public List<SerializedClinic> Clinics { get; set; } = [];
    public SerializedDoctorPersonalization Personalization { get; set; } = new();
    //cabinet identity information

    public string Country { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string PostalCode { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string CodeCnam { get; set; } = string.Empty;

    public bool SelfCheckinEnabled { get; set; } = true;
    public string SelfCheckinKey { get; set; } = string.Empty;
    public int SelfCheckinTimeoutSeconds { get; set; } = 90;

}

public record SerializedClinic(Guid Id, string Name, string Address, string PhoneNumber, string GoogleMapsLink);

public class SerializedDoctorPersonalization
{
    public string CylinderScale { get; set; } = "negatif";
    public string DistanceVisualScale { get; set; } = "snellen";
    public string WaitingRoomMessage { get; set; } = string.Empty;
    public string DailyNews { get; set; } = string.Empty;
    public string DailyNewsFr { get; set; } = string.Empty;
    public string DailyNewsEn { get; set; } = string.Empty;
    public string DailyNewsAr { get; set; } = string.Empty;
    public bool UseSuperAdminDailyNews { get; set; } = true;
    public bool AutoDailyNewsEnabled { get; set; }

    public bool ShowHeader { get; set; } = true;
    public bool ShowFirstName { get; set; } = true;
    public bool ShowLastName { get; set; } = true;
    public bool ShowCodeCnam { get; set; } = true;
    public bool ShowFirstNameArabic { get; set; }
    public bool ShowLastNameArabic { get; set; }

    public bool ShowFooter { get; set; } = true;
    public bool ShowFooterCabinetAddress { get; set; } = true;
    public bool ShowFooterLandline { get; set; } = true;
    public bool ShowFooterMobile { get; set; } = true;
    public bool ShowFooterEmail { get; set; } = true;
}
