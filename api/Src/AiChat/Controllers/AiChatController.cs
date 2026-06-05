using api.Src.Auth.Helpers;
using api.Src.AiChat.Dtos;
using api.Src.AiChat.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace api.Src.AiChat.Controllers;

[ApiController]
[Authorize(Roles = "doctor,admin,super_admin")]
[Route("api/v0/ai-chat")]
public sealed class AiChatController(IAiChatService aiChatService) : ControllerBase
{
    [HttpGet("sessions")]
    public async Task<ActionResult<IReadOnlyList<AiChatSessionResponse>>> GetSessions(
        CancellationToken cancellationToken)
    {
        try
        {
            return Ok(await aiChatService.GetSessionsAsync(User.GetCabinetIdentityId(), cancellationToken));
        }
        catch (AiChatException ex)
        {
            return BadRequest(new AiChatErrorResponse(ex.Message));
        }
        catch (Exception)
        {
            return StatusCode(
                StatusCodes.Status500InternalServerError,
                new AiChatErrorResponse("Impossible d'envoyer le message a l'assistant IA pour le moment."));
        }
    }

    [HttpPost("sessions")]
    public async Task<ActionResult<AiChatSessionResponse>> CreateSession(
        [FromBody] CreateAiChatSessionRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var session = await aiChatService.CreateSessionAsync(
                User.GetCabinetIdentityId(),
                request,
                cancellationToken);

            return CreatedAtAction(nameof(GetSession), new { sessionId = session.Id }, session);
        }
        catch (AiChatException ex)
        {
            return BadRequest(new AiChatErrorResponse(ex.Message));
        }
    }

    [HttpGet("sessions/{sessionId:guid}")]
    public async Task<ActionResult<AiChatSessionResponse>> GetSession(
        [FromRoute] Guid sessionId,
        CancellationToken cancellationToken)
    {
        try
        {
            return Ok(await aiChatService.GetSessionAsync(
                User.GetCabinetIdentityId(),
                sessionId,
                cancellationToken));
        }
        catch (AiChatException ex)
        {
            return NotFound(new AiChatErrorResponse(ex.Message));
        }
    }

    [HttpDelete("sessions/{sessionId:guid}")]
    public async Task<IActionResult> DeleteSession(
        [FromRoute] Guid sessionId,
        CancellationToken cancellationToken)
    {
        try
        {
            await aiChatService.DeleteSessionAsync(User.GetCabinetIdentityId(), sessionId, cancellationToken);
            return NoContent();
        }
        catch (AiChatException ex)
        {
            return NotFound(new AiChatErrorResponse(ex.Message));
        }
    }

    [HttpPost("sessions/{sessionId:guid}/messages")]
    public async Task<ActionResult<AiChatSessionResponse>> SendMessage(
        [FromRoute] Guid sessionId,
        [FromBody] SendAiChatMessageRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            return Ok(await aiChatService.SendMessageAsync(
                User.GetCabinetIdentityId(),
                sessionId,
                request,
                cancellationToken));
        }
        catch (AiChatException ex)
        {
            return BadRequest(new AiChatErrorResponse(ex.Message));
        }
    }

    [HttpDelete("sessions/{sessionId:guid}/messages/{messageId:guid}")]
    public async Task<IActionResult> DeleteMessage(
        [FromRoute] Guid sessionId,
        [FromRoute] Guid messageId,
        CancellationToken cancellationToken)
    {
        try
        {
            await aiChatService.DeleteMessageAsync(
                User.GetCabinetIdentityId(),
                sessionId,
                messageId,
                cancellationToken);

            return NoContent();
        }
        catch (AiChatException ex)
        {
            return NotFound(new AiChatErrorResponse(ex.Message));
        }
    }

    [HttpPost("complete")]
    public async Task<ActionResult<AiChatCompletionResponse>> Complete(
        [FromBody] AiChatCompletionRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            return Ok(await aiChatService.CompleteAsync(request, cancellationToken));
        }
        catch (AiChatException ex)
        {
            return StatusCode(StatusCodes.Status502BadGateway, new AiChatErrorResponse(ex.Message));
        }
    }
}
