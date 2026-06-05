using api.Src.AgendaSpace.Dtos.Requests;
using api.Src.AgendaSpace.Entities;
using api.Src.AgendaSpace.Services;
using api.Src.Auth.Helpers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace api.Src.AgendaSpace.Controllers;

[Route("api/v0/agenda")]
[ApiController]
[Authorize]
public class AgendaController(AgendaService agendaService) : ControllerBase
{
    [HttpGet("rdvs")]
    public async Task<ActionResult> GetRdvsByMonth([FromQuery] string monthPrefix)
    {
        try
        {
            var cabinetIdentityId = User.GetCabinetIdentityId();
            var result = await agendaService.GetRdvsByMonthAsync(cabinetIdentityId, monthPrefix);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPost("rdvs")]
    public async Task<ActionResult> CreateRdv([FromBody] Rdv rdv)
    {
        try
        {
            var cabinetIdentityId = User.GetCabinetIdentityId();
            rdv.CabinetIdentityId = cabinetIdentityId;
            var result = await agendaService.CreateRdvAsync(rdv);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPost("consultations/{consultationId:guid}/next-rdv")]
    public async Task<ActionResult> CreateConsultationRdv(
        [FromRoute] Guid consultationId,
        [FromBody] CreateConsultationRdvRequest request)
    {
        try
        {
            var cabinetIdentityId = User.GetCabinetIdentityId();
            var result = await agendaService.CreateConsultationRdvAsync(
                cabinetIdentityId,
                consultationId,
                request);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPut("rdvs/{id:guid}")]
    public async Task<ActionResult> UpdateRdv([FromRoute] Guid id, [FromBody] Rdv rdv)
    {
        try
        {
            var cabinetIdentityId = User.GetCabinetIdentityId();
            rdv.CabinetIdentityId = cabinetIdentityId;
            rdv.Id = id;
            var result = await agendaService.UpdateRdvAsync(rdv);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpDelete("rdvs/{id:guid}")]
    public async Task<ActionResult> DeleteRdv([FromRoute] Guid id)
    {
        try
        {
            var cabinetIdentityId = User.GetCabinetIdentityId();
            await agendaService.DeleteRdvAsync(cabinetIdentityId, id);
            return Ok(new { Message = "RDV deleted successfully" });
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpGet("leaves")]
    public async Task<ActionResult> GetLeavesByYear([FromQuery] string yearPrefix)
    {
        try
        {
            var cabinetIdentityId = User.GetCabinetIdentityId();
            var result = await agendaService.GetLeavesByYearAsync(cabinetIdentityId, yearPrefix);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPost("leaves")]
    public async Task<ActionResult> CreateLeave([FromBody] Leave leave)
    {
        try
        {
            var cabinetIdentityId = User.GetCabinetIdentityId();
            leave.CabinetIdentityId = cabinetIdentityId;
            var result = await agendaService.CreateLeaveAsync(leave);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPut("leaves/{id:guid}")]
    public async Task<ActionResult> UpdateLeave([FromRoute] Guid id, [FromBody] Leave leave)
    {
        try
        {
            var cabinetIdentityId = User.GetCabinetIdentityId();
            leave.CabinetIdentityId = cabinetIdentityId;
            leave.Id = id;
            var result = await agendaService.UpdateLeaveAsync(leave);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpDelete("leaves/{id:guid}")]
    public async Task<ActionResult> DeleteLeave([FromRoute] Guid id)
    {
        try
        {
            var cabinetIdentityId = User.GetCabinetIdentityId();
            await agendaService.DeleteLeaveAsync(cabinetIdentityId, id);
            return Ok(new { Message = "Leave deleted successfully" });
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpGet("settings")]
    public async Task<ActionResult> GetSettings()
    {
        try
        {
            var cabinetIdentityId = User.GetCabinetIdentityId();
            var result = await agendaService.GetSettingsAsync(cabinetIdentityId);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPut("settings")]
    public async Task<ActionResult> UpdateSettings([FromBody] CalendarSettings settings)
    {
        try
        {
            var cabinetIdentityId = User.GetCabinetIdentityId();
            settings.CabinetIdentityId = cabinetIdentityId;
            var result = await agendaService.UpdateSettingsAsync(settings);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpGet("holidays")]
    public ActionResult GetHolidays()
    {
        try
        {
            var result = agendaService.GetFixedHolidays();
            return Ok(result);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }
}
