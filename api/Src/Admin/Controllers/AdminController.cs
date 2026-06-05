using api.Src.Admin.Dtos.Requests;
using api.Src.Admin.Dtos.Responses;
using api.Src.Auth.Helpers;
using api.Src.Admin.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace api.Src.Admin.Controllers
{
    [Authorize(Roles = "admin,super_admin")]
    [Route("api/v0/admin")]
    [ApiController]
    public class AdminController(IAdminService adminService) : ControllerBase
    {
        [HttpPost("doctors")]
        public async Task<ActionResult> AddNewDoctor([FromBody] AddNewDoctorRequest request)
        {
            try
            {
                await adminService.AddNewDoctorAsync(request);
                return Ok(new { Message = "Doctor added successfully" });
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpGet("doctors")]
        public async Task<ActionResult> GetDoctors(
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 10,
            [FromQuery] string? searchQuery = null,
            [FromQuery] string? sortBy = null,
            [FromQuery] string? sortDirection = null,
            [FromQuery] string? roleFilter = null,
            [FromQuery] string? statusFilter = null)
        {
            try
            {
                var result = await adminService.GetDoctorsAsync(pageNumber, pageSize, searchQuery, sortBy, sortDirection, roleFilter, statusFilter);
                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpGet("doctors/{id:guid}")]
        public async Task<ActionResult<DoctorListItemResponse>> GetDoctorById([FromRoute] Guid id)
        {
            try
            {
                var result = await adminService.GetDoctorByIdAsync(id);
                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpPut("doctors/{id:guid}")]
        public async Task<ActionResult<DoctorListItemResponse>> UpdateDoctorByAdmin([FromRoute] Guid id, [FromBody] UpdateDoctorByAdminRequest request)
        {
            try
            {
                var result = await adminService.UpdateDoctorByAdminAsync(id, request);
                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpPatch("doctors/{id:guid}/suspend")]
        public async Task<ActionResult> SuspendDoctor([FromRoute] Guid id)
        {
            try
            {
                var actorCabinetIdentityId = User.GetCabinetIdentityId();
                await adminService.SuspendDoctorAsync(id, actorCabinetIdentityId);
                return Ok(new { Message = "Doctor account suspended successfully" });
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpPatch("doctors/{id:guid}/reactivate")]
        public async Task<ActionResult> ReactivateDoctor([FromRoute] Guid id, [FromBody] ReactivateDoctorRequest request)
        {
            try
            {
                var actorCabinetIdentityId = User.GetCabinetIdentityId();
                await adminService.ReactivateDoctorAsync(id, actorCabinetIdentityId, request.SubscriptionDurationInMonths);
                return Ok(new { Message = "Doctor account reactivated successfully" });
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpPatch("doctors/{id:guid}/role")]
        public async Task<ActionResult> ChangeDoctorRole([FromRoute] Guid id, [FromBody] ChangeDoctorRoleRequest request)
        {
            try
            {
                var actorCabinetIdentityId = User.GetCabinetIdentityId();
                var actorRole = User.GetRoleOrThrow();
                await adminService.ChangeDoctorRoleAsync(id, actorCabinetIdentityId, actorRole, request.Role, request.SubscriptionDurationInMonths);
                return Ok(new { Message = "Doctor role updated successfully" });
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpDelete("admins/{id:guid}")]
        public async Task<ActionResult> RemoveAdmin([FromRoute] Guid id)
        {
            try
            {
                var actorCabinetIdentityId = User.GetCabinetIdentityId();
                var actorRole = User.GetRoleOrThrow();
                await adminService.RemoveAdminAsync(id, actorCabinetIdentityId, actorRole);
                return Ok(new { Message = "Admin account removed successfully" });
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpDelete("doctors/{id:guid}")]
        public async Task<ActionResult> DeleteDoctor([FromRoute] Guid id)
        {
            try
            {
                var actorCabinetIdentityId = User.GetCabinetIdentityId();
                var actorRole = User.GetRoleOrThrow();
                await adminService.DeleteDoctorAsync(id, actorCabinetIdentityId, actorRole);
                return Ok(new { Message = "Doctor account deleted successfully" });
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }
    }
}
