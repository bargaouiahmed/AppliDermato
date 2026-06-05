using System;

namespace api.Src.Auth.Dtos;

public class ChangeAutoAssignedPasswordRequest
{
    public required string OldPassword { get; set; }
    public required string NewPassword { get; set; }

}
