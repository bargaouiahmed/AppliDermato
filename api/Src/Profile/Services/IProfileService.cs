using System;
using api.Src.Profile.Dtos.Requests;

namespace api.Src.Profile.Services;

public interface IProfileService
{
    public Task<DoctorObjectFromClient> UpdateDoctorProfile(DoctorObjectFromClient updatedProfile);
    public Task UpdateDoctorPassword(Guid doctorIdentityId, UpdateDoctorPasswordRequest request);


}

