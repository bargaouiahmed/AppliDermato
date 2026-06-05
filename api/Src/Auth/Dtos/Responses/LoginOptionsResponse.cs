using System;

namespace api.Src.Auth.Dtos.Responses;

public class LoginOptionsResponse
{
    public required string DoctorFirstname { get; set; }
    public required string DoctorLastname { get; set; }
    public List<SecDto>? Secretaries { get; set; }
    public bool IsSecondSecretaryActive { get; set; }
}

public record SecDto(string Firstname, string Lastname, Guid Id, int index);
