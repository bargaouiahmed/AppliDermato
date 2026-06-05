using System;

namespace api.Src.PatientSpace.Dtos.requests;

public class UpdatePateinetRequest
{
    public string? Firstname { get; set; }
    public string? Lastname { get; set; }
    public DateTime? DateOfBirth { get; set; }
    public string? PhoneNumber { get; set; }
    public string? Country { get; set; }
    public string? Profession { get; set; }
    public string? WorkPlace { get; set; }
    public string? Sex { get; set; }
    public string? FamilialStatus { get; set; }
    public string? City { get; set; }
    public string? Address { get; set; }
    public string? PostalCode { get; set; }
    public string? Email { get; set; }
    public string? APCI { get; set; }
    public string? InsuranceType { get; set; }
    public string? InsuranceEstablishment { get; set; }


}
