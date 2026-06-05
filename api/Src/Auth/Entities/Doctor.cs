using System;
using api.DatabaseRules;

namespace api.Src.Auth.Entities;

public class Doctor : BaseEntity
{
    public Guid Id { get; set; }
    public string Firstname { get; set; } = string.Empty;
    public string Lastname { get; set; } = string.Empty;
    public string FirstnameAr { get; set; } = string.Empty;
    public string LastnameAr { get; set; } = string.Empty;

    public string Gender { get; set; } = string.Empty;
    public DateTime DateOfBirth { get; set; }
    public string Nationality { get; set; } = string.Empty;
    //contact info
    public string PhoneNumber { get; set; } = string.Empty;
    public string Landline { get; set; } = string.Empty;
    //cabinet information
    public string LanguagePreference { get; set; } = "fr"; //could be "ar, "fr", "en"
    public string Role { get; set; } = string.Empty; //note for future ahmed Roles will be ["doctor", "admin", "super_admin"]

    public bool SelfCheckinEnabled { get; set; } = true;
    public string? SelfCheckinKey { get; set; }
    public int SelfCheckinTimeoutSeconds { get; set; } = 90;


    public Guid CabinetIdentityId { get; set; }
    public CabinetIdentity? CabinetIdentity { get; set; }

    public ICollection<Clinic> Clinics { get; set; } = [];
    public DoctorPersonalization? Personalization { get; set; }

}
