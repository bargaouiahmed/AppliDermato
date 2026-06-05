using api.Src.Auth.Helpers;
using api.Src.ConsultationSpace.DocumentsSection.Dtos.Requests;
using api.Src.ConsultationSpace.DocumentsSection.Dtos.Responses;
using api.Src.ConsultationSpace.DocumentsSection.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace api.Src.ConsultationSpace.DocumentsSection.Controllers;

[Route("api/v0/documents/consultations")]
[ApiController]
[Authorize(Roles = "secretary,doctor,admin,super_admin")]
public class DocumentsController(IConsultationDocumentsService documentsService) : ControllerBase
{
    [HttpGet("{consultationId:guid}")]
    public async Task<ActionResult<ConsultationDocumentsResponse>> GetConsultationDocuments([FromRoute] Guid consultationId)
    {
        try
        {
            var cabinetIdentityId = User.GetCabinetIdentityId();
            var response = await documentsService.GetConsultationDocuments(consultationId, cabinetIdentityId);
            return Ok(response);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPost("{consultationId:guid}/exploration")]
    public async Task<ActionResult<ConsultationExplorationDocumentResponse>> CreateExplorationDocument(
        [FromRoute] Guid consultationId,
        [FromForm] CreateExplorationDocumentRequest request)
    {
        try
        {
            var cabinetIdentityId = User.GetCabinetIdentityId();
            var response = await documentsService.CreateExplorationDocument(
                consultationId,
                request,
                cabinetIdentityId);
            return Ok(response);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpDelete("{consultationId:guid}/exploration/{documentId:guid}")]
    public async Task<IActionResult> DeleteExplorationDocument(
        [FromRoute] Guid consultationId,
        [FromRoute] Guid documentId)
    {
        try
        {
            var cabinetIdentityId = User.GetCabinetIdentityId();
            await documentsService.DeleteExplorationDocument(consultationId, documentId, cabinetIdentityId);
            return NoContent();
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }
}
