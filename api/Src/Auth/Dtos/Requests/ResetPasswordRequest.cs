using System;

namespace api.Src.Auth.Dtos.Requests;

public class ResetPasswordRequest
{
    public required string Email { get; set; }
    public required string NewPassword { get; set; }
    public required string ResetToken { get; set; }

}
