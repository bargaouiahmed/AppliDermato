using System;

namespace api.Src.PatientSpace.Dtos.requests;

public class AddPatientRequest
{
    public required string Firstname { get; set; }
    public required string Lastname { get; set; }
    public required DateTime DateOfBirth { get; set; }
    public string PhoneNumber { get; set; } = string.Empty;
    public string Country { get; set; } = string.Empty;
    public string Profession { get; set; } = string.Empty;
    public string WorkPlace { get; set; } = string.Empty;
    public required string Sex { get; set; }
    public string FamilialStatus { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string PostalCode { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string APCI { get; set; } = string.Empty;
    public string InsuranceType { get; set; } = string.Empty;
    public string InsuranceEstablishment { get; set; } = string.Empty;
}

