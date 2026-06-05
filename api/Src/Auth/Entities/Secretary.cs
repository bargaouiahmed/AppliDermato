using System;
using api.DatabaseRules;

namespace api.Src.Auth.Entities;

public class Secretary : BaseEntity
{
    public Guid Id { get; set; }
    public string Firstname { get; set; } = string.Empty;
    public string Lastname { get; set; } = string.Empty;

    public int SecretaryIndex { get; set; } //to enforce 2 secretaries per doctor
    public Guid CabinetIdentityId { get; set; }
    public CabinetIdentity? CabinetIdentity { get; set; }

}
