using api.Src.Auth.Helpers;
using api.Src.Suggestions.Dtos;
using api.Src.Suggestions.Realtime;
using api.Src.Suggestions.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;

namespace api.Src.Suggestions.Controllers;

[Route("api/v0/suggestions")]
[ApiController]
[Authorize(Roles = "doctor,admin,super_admin")]
public class SuggestionsController(
    SuggestionService suggestionService,
    IHubContext<SuggestionHub> hubContext) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<SuggestionResponse>>> GetSuggestions()
    {
        try
        {
            return Ok(await suggestionService.GetSuggestionsAsync(User));
        }
        catch (Exception ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }

    [HttpPost]
    public async Task<ActionResult<SuggestionResponse>> CreateSuggestion(
        [FromBody] CreateSuggestionRequest request)
    {
        try
        {
            var result = await suggestionService.CreateSuggestionAsync(User, request);
            var adminUnreadCount = await suggestionService.GetAdminUnreadCountAsync();

            await hubContext.Clients.Group(SuggestionHub.AdminsGroup)
                .SendAsync("suggestionCreated", result);
            await hubContext.Clients.Group(SuggestionHub.AdminsGroup)
                .SendAsync("suggestionUnreadCountChanged", new { count = adminUnreadCount });

            return CreatedAtAction(nameof(GetSuggestions), new { id = result.Id }, result);
        }
        catch (Exception ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }

    [HttpPost("{id:guid}/replies")]
    public async Task<ActionResult<SuggestionResponse>> Reply(
        [FromRoute] Guid id,
        [FromBody] ReplyToSuggestionRequest request)
    {
        try
        {
            var result = await suggestionService.ReplyAsync(User, id, request);
            var doctorUnreadCount = await suggestionService.GetDoctorUnreadCountAsync(result.CabinetIdentityId);
            await hubContext.Clients.Group(SuggestionHub.BuildDoctorGroup(result.CabinetIdentityId))
                .SendAsync("suggestionReplied", result);
            await hubContext.Clients.Group(SuggestionHub.BuildDoctorGroup(result.CabinetIdentityId))
                .SendAsync("suggestionUnreadCountChanged", new { count = doctorUnreadCount });
            await hubContext.Clients.Group(SuggestionHub.AdminsGroup)
                .SendAsync("suggestionUpdated", result);

            return Ok(result);
        }
        catch (Exception ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }

    [HttpGet("unread-count")]
    public async Task<ActionResult<SuggestionUnreadCountResponse>> GetUnreadCount()
    {
        try
        {
            return Ok(await suggestionService.GetUnreadCountAsync(User));
        }
        catch (Exception ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }
}
