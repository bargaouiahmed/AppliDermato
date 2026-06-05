using System;
using api.DatabaseRules;
using api.Src.Auth.Entities;
using api.Src.ConsultationSpace.Entities;

namespace api.Src.PatientSpace.Entities;

public class Patient : BaseEntity
{
    public Guid Id { get; set; }
    public int DossierNumber { get; set; }
    public string Firstname { get; set; } = string.Empty;
    public string Lastname { get; set; } = string.Empty;
    public DateTime DateOfBirth { get; set; } = DateTime.UtcNow;
    public string PhoneNumber { get; set; } = string.Empty;
    public string Country { get; set; } = string.Empty;
    public string Profession { get; set; } = string.Empty;
    public string WorkPlace { get; set; } = string.Empty;
    public string Sex { get; set; } = string.Empty;
    public string FamilialStatus { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string PostalCode { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string APCI { get; set; } = string.Empty;
    public string InsuranceType { get; set; } = string.Empty;
    public string InsuranceEstablishment { get; set; } = string.Empty;

    public ICollection<Consultation> Consultations { get; set; } = [];

    public Guid CabinetIdentityId { get; set; }
    public CabinetIdentity? CabinetIdentity { get; set; } 
}
