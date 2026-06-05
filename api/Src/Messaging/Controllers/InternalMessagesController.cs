using api.Src.Auth.Helpers;
using api.Src.Messaging.Dtos;
using api.Src.Messaging.Realtime;
using api.Src.Messaging.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;

namespace api.Src.Messaging.Controllers;

[Route("api/v0/messages")]
[ApiController]
[Authorize(Roles = "secretary,secretary1,secretary2,secretaire1,secretaire2,doctor,admin,super_admin")]
public class InternalMessagesController(
    InternalMessagingService messagingService,
    IHubContext<InternalMessagingHub> hubContext) : ControllerBase
{
    [HttpGet("bootstrap")]
    public async Task<ActionResult<InternalMessagingBootstrapResponse>> GetBootstrap()
    {
        try
        {
            var cabinetIdentityId = User.GetCabinetIdentityId();
            var result = await messagingService.GetBootstrapAsync(cabinetIdentityId, User);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }

    [HttpGet]
    public async Task<ActionResult<List<InternalMessageResponse>>> GetMessages()
    {
        try
        {
            var cabinetIdentityId = User.GetCabinetIdentityId();
            var result = await messagingService.GetMessagesForCabinetAsync(cabinetIdentityId, User);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }

    [HttpGet("room/{roomId}")]
    public async Task<ActionResult<List<InternalMessageResponse>>> GetMessagesByRoom([FromRoute] string roomId)
    {
        try
        {
            var cabinetIdentityId = User.GetCabinetIdentityId();
            var result = await messagingService.GetMessagesByRoomAsync(cabinetIdentityId, roomId, User);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }

    [HttpPost]
    public async Task<ActionResult<InternalMessageResponse>> SendMessage([FromBody] SendInternalMessageRequest request)
    {
        try
        {
            var cabinetIdentityId = User.GetCabinetIdentityId();
            var result = await messagingService.CreateMessageAsync(cabinetIdentityId, request, User);
            await hubContext.Clients
                .Group(InternalMessagingHub.BuildRoomGroup(cabinetIdentityId, result.RoomId))
                .SendAsync("messageReceived", result);

            return CreatedAtAction(nameof(GetMessagesByRoom), new { roomId = result.RoomId }, result);
        }
        catch (Exception ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }

    [HttpPatch("{id:guid}")]
    public async Task<ActionResult<InternalMessageResponse>> EditMessage(
        [FromRoute] Guid id,
        [FromBody] EditInternalMessageRequest request)
    {
        try
        {
            var cabinetIdentityId = User.GetCabinetIdentityId();
            var result = await messagingService.EditMessageAsync(cabinetIdentityId, id, request, User);
            await hubContext.Clients
                .Group(InternalMessagingHub.BuildRoomGroup(cabinetIdentityId, result.RoomId))
                .SendAsync("messageUpdated", new { roomId = result.RoomId, message = result });

            return Ok(result);
        }
        catch (Exception ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult<InternalMessageResponse>> DeleteMessage(
        [FromRoute] Guid id,
        [FromBody] DeleteInternalMessageRequest request)
    {
        try
        {
            var cabinetIdentityId = User.GetCabinetIdentityId();
            var result = await messagingService.DeleteMessageAsync(cabinetIdentityId, id, request, User);
            await hubContext.Clients
                .Group(InternalMessagingHub.BuildRoomGroup(cabinetIdentityId, result.RoomId))
                .SendAsync("messageDeleted", new { roomId = result.RoomId, message = result });

            return Ok(result);
        }
        catch (Exception ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }

    [HttpPatch("room/{roomId}/seen")]
    public async Task<ActionResult<List<InternalMessageResponse>>> MarkRoomSeen(
        [FromRoute] string roomId,
        [FromBody] MarkInternalRoomSeenRequest request)
    {
        try
        {
            var cabinetIdentityId = User.GetCabinetIdentityId();
            var result = await messagingService.MarkRoomSeenAsync(cabinetIdentityId, roomId, request, User);
            var viewer = messagingService.ResolveSender(User, request.Viewer);
            await hubContext.Clients
                .Group(InternalMessagingHub.BuildRoomGroup(cabinetIdentityId, roomId))
                .SendAsync("messagesSeen", new { roomId, viewer });

            return Ok(result);
        }
        catch (Exception ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }
}
