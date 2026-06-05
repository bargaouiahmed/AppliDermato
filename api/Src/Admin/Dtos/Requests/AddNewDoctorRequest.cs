using System;

namespace api.Src.Admin.Dtos.Requests;

public class AddNewDoctorRequest
{
    public required string Firstname { get; set; }
    public required string Lastname { get; set; }
    public required string Email { get; set; }
    public required string Nationality { get; set; }
    public required string Role { get; set; } //admin, doctor
    public required string PhoneNumber { get; set; }
    public required string Landline { get; set; }
    public required string CabinetCountry { get; set; }
    public required string CabinetCity { get; set; }
    public required string CabinetAddress { get; set; }
    public string LanguagePreference { get; set; } = "fr";
    public required string CabinetPostalCode { get; set; }
    public string? NotesFromAdmin { get; set; }
    public int SubscriptionDurationInMonths { get; set; } = 12; // Default to 12 month if not specified

}
