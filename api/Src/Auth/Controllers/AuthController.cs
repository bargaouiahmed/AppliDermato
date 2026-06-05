using api.Src.Auth.Dtos;
using api.Src.Auth.Dtos.Requests;
using api.Src.Auth.Dtos.Responses;
using api.Src.Auth.Helpers;
using api.Src.Auth.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace api.Src.Auth.Controllers
{
    [Route("api/v0/auth")]
    [ApiController]
    public class AuthController(IAuthService auth) : ControllerBase
    {
        [HttpPost("signin")]
        public async Task<ActionResult<TokenPairResponse>> SignIn([FromBody] SignInRequest request)
        {
            try
            {
                var result = await auth.GetAccountsForCabinet(request);
                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }
        [HttpPost("signin-with-role")]
        public async Task<ActionResult<TokenPairResponse>> SignInWithRole([FromBody] SignInRequestWithRole request)
        {
            try
            {
                var result = await auth.SignIn(request);
                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }
        [HttpGet("send-password-reset-email")]
        public async Task<ActionResult> SendPasswordResetEmail([FromQuery] string email, [FromQuery] string lang = "fr")
        {
            try
            {
                await auth.SendPasswordResetEmail(email, lang);
                return Ok(new { Message = "Password reset email sent successfully" });
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }
        [HttpPost("reset-password")]
        public async Task<ActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
        {
            try
            {
                await auth.ResetPassword(request);
                return Ok(new { Message = "Password reset successfully" });
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [Authorize(Roles = "doctor,admin,super_admin,secretary,secretary1,secretary2,secretaire1,secretaire2")]
        [HttpGet("me")]
        public async Task<ActionResult<SerializedDoctorProfile>> GetAuthenticatedDoctorAccount()
        {
            try
            {
                var id = User.GetCabinetIdentityId();
                var role = User.GetRoleOrThrow();
                var result = await auth.GetAuthenticatedDoctorAccount(id, role);
                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }
        [Authorize(Roles = "doctor_auto_pass_unchanged,admin_auto_pass_unchanged")]
        [HttpPut("change-auto-assigned-password")]
        public async Task<ActionResult<TokenPairResponse>> ChangeAutoAssignedPassword([FromBody] ChangeAutoAssignedPasswordRequest request)
        {
            try
            {
                var id = User.GetCabinetIdentityId();
                var response = await auth.ChangeAutoAssignedPassword(id, request);
                return Ok(response);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

    }
}
