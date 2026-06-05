using System;
using api.Src.Auth.Dtos.Responses;

namespace api.Src.Profile.Dtos.Requests;

public class DoctorObjectFromClient
{
    public Guid? Id { get; set; }
    public Guid? DoctorId { get; set; }
    public string? Firstname { get; set; }
    public string? Lastname { get; set; }
    public string? Role { get; set; }
    public string? Email { get; set; }

    public string? FirstnameAr { get; set; }
    public string? LastnameAr { get; set; }


    public string? Country { get; set; }
    public string? Address { get; set; }
    public string? PostalCode { get; set; }
    public string? City { get; set; }
    public string? CodeCnam { get; set; }
    public IFormFile? Pfp { get; set; }
    public string? ProfilePictureUrl { get; set; }
    public string? Gender { get; set; }
    public DateTime? DateOfBirth { get; set; }
    public string? Nationality { get; set; }
    public string? PhoneNumber { get; set; }
    public string? Landline { get; set; }
    public List<SecDtoWithoutId>? Secretaries { get; set; }
    public bool? ClearFirstSecretary { get; set; }
    public bool? ClearSecondSecretary { get; set; }
    public bool? IsSecondSecretaryActive { get; set; }
    public bool? SelfCheckinEnabled { get; set; }
    public string? SelfCheckinKey { get; set; }
    public int? SelfCheckinTimeoutSeconds { get; set; }
    public bool? ClearClinics { get; set; }
    public List<SerializedClinicWithoutId>? Clinics { get; set; }
    public DoctorPersonalizationObjectFromClient? Personalization { get; set; }
}

public class DoctorPersonalizationObjectFromClient
{
    public string? CylinderScale { get; set; }
    public string? DistanceVisualScale { get; set; }
    public string? WaitingRoomMessage { get; set; }
    public string? DailyNews { get; set; }
    public string? DailyNewsFr { get; set; }
    public string? DailyNewsEn { get; set; }
    public string? DailyNewsAr { get; set; }
    public bool? DailyNewsSet { get; set; }
    public bool? UseSuperAdminDailyNews { get; set; }
    public bool? AutoDailyNewsEnabled { get; set; }

    public bool? ShowHeader { get; set; }
    public bool? ShowFirstName { get; set; }
    public bool? ShowLastName { get; set; }
    public bool? ShowCodeCnam { get; set; }
    public bool? ShowFirstNameArabic { get; set; }
    public bool? ShowLastNameArabic { get; set; }

    public bool? ShowFooter { get; set; }
    public bool? ShowFooterCabinetAddress { get; set; }
    public bool? ShowFooterLandline { get; set; }
    public bool? ShowFooterMobile { get; set; }
    public bool? ShowFooterEmail { get; set; }
}

public class SecDtoWithoutId
{
    public SecDtoWithoutId()
    {
    }

    public SecDtoWithoutId(string? firstname, string? lastname, int? index)
    {
        Firstname = firstname;
        Lastname = lastname;
        Index = index;
    }

    public string? Firstname { get; set; }
    public string? Lastname { get; set; }
    public int? Index { get; set; }
}

public record SerializedClinicWithoutId(string? Name, string? Address, string? PhoneNumber, string? GoogleMapsLink);
