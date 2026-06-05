using System;

namespace api.Src.Auth.Dtos.Requests;

public class SignInRequestWithRole
{
    public required string Email { get; set; }
    public required string Password { get; set; }
    public required string Role { get; set; } //"doctor, secretary1, secretary2"

}
