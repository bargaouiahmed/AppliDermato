using System;
using api.Src.Auth.Helpers;
using api.Src.Profile.Dtos.Requests;
using api.Src.Profile.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace api.Src.Profile.Controllers
{

    [Route("api/v0/profile")]
    [ApiController]
    public class ProfileController(IProfileService profileService) : ControllerBase
    {


        [Authorize(Roles = "doctor,admin,super_admin")]
        [HttpPut]
        public async Task<ActionResult<DoctorObjectFromClient>> UpdateDoctorProfile([FromForm] DoctorObjectFromClient updatedProfile)
        {
            try
            {
                if (!updatedProfile.Id.HasValue)
                {
                    return BadRequest("Id is required.");
                }

                var id = User.GetCabinetIdentityId();
                if (id != updatedProfile.Id.Value)
                {
                    return Forbid("You can only update your own profile.");
                }

                var result = await profileService.UpdateDoctorProfile(updatedProfile);
                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }

        }
        [Authorize(Roles = "doctor,admin,super_admin")]
        [HttpPut("password")]
        public async Task<ActionResult> UpdateDoctorPassword([FromBody] UpdateDoctorPasswordRequest request)
        {
            try
            {
                var id = User.GetCabinetIdentityId();
                _ = User.GetRoleOrThrow();
                await profileService.UpdateDoctorPassword(id, request);
                return Ok(new { Message = "Password updated successfully" });
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }

        }
    }
}
