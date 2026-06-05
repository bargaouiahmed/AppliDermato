namespace api.Src.Admin.Dtos.Requests;

public class UpdateDoctorByAdminRequest
{
    public string? Firstname { get; set; }
    public string? Lastname { get; set; }
    public string? Email { get; set; }
    public string? Nationality { get; set; }
    public string? PhoneNumber { get; set; }
    public string? Landline { get; set; }
    public string? CabinetCountry { get; set; }
    public string? CabinetCity { get; set; }
    public string? CabinetAddress { get; set; }
    public string? CabinetPostalCode { get; set; }
    public string? NotesFromAdmin { get; set; }
    public string? LanguagePreference { get; set; }
}
