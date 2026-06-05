using System;
using api.DatabaseRules;

namespace api.Src.Auth.Entities;

public class Clinic : BaseEntity
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;

    public string PhoneNumber { get; set; } = string.Empty;

    public string GoogleMapsLink { get; set; } = string.Empty;


    public Guid DoctorId { get; set; }
    public Doctor? Doctor { get; set; }
}
