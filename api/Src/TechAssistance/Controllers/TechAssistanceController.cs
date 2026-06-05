using api.Src.Auth.Helpers;
using api.Src.TechAssistance.Dtos;
using api.Src.TechAssistance.Realtime;
using api.Src.TechAssistance.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;

namespace api.Src.TechAssistance.Controllers;

[Route("api/v0/tech-assistance")]
[ApiController]
[Authorize(Roles = "doctor,admin,super_admin")]
public class TechAssistanceController(
    TechAssistanceService techAssistanceService,
    IHubContext<TechAssistanceHub> hubContext) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<TechAssistanceTicketResponse>>> GetTickets()
    {
        try
        {
            return Ok(await techAssistanceService.GetTicketsAsync(User));
        }
        catch (Exception ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }

    [HttpPost]
    [RequestSizeLimit(60 * 1024 * 1024)]
    public async Task<ActionResult<TechAssistanceTicketResponse>> CreateTicket(
        [FromForm] CreateTechAssistanceTicketRequest request)
    {
        try
        {
            var result = await techAssistanceService.CreateTicketAsync(User, request);
            var adminUnreadCount = await techAssistanceService.GetAdminUnreadCountAsync();

            await hubContext.Clients.Group(TechAssistanceHub.AdminsGroup)
                .SendAsync("techTicketCreated", result);
            await hubContext.Clients.Group(TechAssistanceHub.AdminsGroup)
                .SendAsync("techTicketUnreadCountChanged", new { count = adminUnreadCount });

            return CreatedAtAction(nameof(GetTickets), new { id = result.Id }, result);
        }
        catch (Exception ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }

    [HttpPost("{id:guid}/messages")]
    [RequestSizeLimit(60 * 1024 * 1024)]
    public async Task<ActionResult<TechAssistanceTicketResponse>> AddMessage(
        [FromRoute] Guid id,
        [FromForm] CreateTechAssistanceMessageRequest request)
    {
        try
        {
            var result = await techAssistanceService.AddMessageAsync(User, id, request);
            await BroadcastTicketUpdateAsync(result);

            return Ok(result);
        }
        catch (Exception ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }

    [HttpPost("{id:guid}/notify-tech-lead")]
    public async Task<ActionResult<TechAssistanceTicketResponse>> NotifyTechLead([FromRoute] Guid id)
    {
        try
        {
            var result = await techAssistanceService.NotifyTechLeadAsync(User, id);
            await BroadcastTicketUpdateAsync(result);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }

    [HttpPatch("{id:guid}/close")]
    public async Task<ActionResult<TechAssistanceTicketResponse>> CloseTicket([FromRoute] Guid id)
    {
        try
        {
            var result = await techAssistanceService.CloseTicketAsync(User, id);
            await BroadcastTicketUpdateAsync(result);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }

    [HttpGet("unread-count")]
    public async Task<ActionResult<TechAssistanceUnreadCountResponse>> GetUnreadCount()
    {
        try
        {
            return Ok(await techAssistanceService.GetUnreadCountAsync(User));
        }
        catch (Exception ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }

    [HttpPost("public/review/{id:guid}")]
    [AllowAnonymous]
    public async Task<ActionResult<TechAssistanceTicketResponse>> GetTicketForTechLead(
        [FromRoute] Guid id,
        [FromBody] TechLeadReviewRequest request)
    {
        try
        {
            return Ok(await techAssistanceService.GetTicketForTechLeadAsync(id, request));
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { Message = ex.Message });
        }
        catch (Exception ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }

    private async Task BroadcastTicketUpdateAsync(TechAssistanceTicketResponse ticket)
    {
        var adminUnreadCount = await techAssistanceService.GetAdminUnreadCountAsync();
        var doctorUnreadCount = await techAssistanceService.GetDoctorUnreadCountAsync(ticket.CabinetIdentityId);

        await hubContext.Clients.Group(TechAssistanceHub.AdminsGroup)
            .SendAsync("techTicketUpdated", ticket);
        await hubContext.Clients.Group(TechAssistanceHub.AdminsGroup)
            .SendAsync("techTicketUnreadCountChanged", new { count = adminUnreadCount });
        await hubContext.Clients.Group(TechAssistanceHub.BuildDoctorGroup(ticket.CabinetIdentityId))
            .SendAsync("techTicketUpdated", ticket);
        await hubContext.Clients.Group(TechAssistanceHub.BuildDoctorGroup(ticket.CabinetIdentityId))
            .SendAsync("techTicketUnreadCountChanged", new { count = doctorUnreadCount });
    }
}
