using System;

namespace api.Src.Profile.Dtos.Requests;

public class UpdateDoctorPasswordRequest
{
    public required string OldPassword { get; set; }
    public required string NewPassword { get; set; }

}
