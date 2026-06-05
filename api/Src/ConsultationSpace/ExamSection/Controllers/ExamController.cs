using api.Src.Auth.Helpers;
using api.Src.ConsultationSpace.ExamSection.Dtos.Requests;
using api.Src.ConsultationSpace.ExamSection.Dtos.Responses;
using api.Src.ConsultationSpace.ExamSection.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace api.Src.ConsultationSpace.ExamSection.Controllers;

[Route("api/v0/exam/consultations")]
[ApiController]
[Authorize(Roles = "doctor,admin,super_admin")]
public class ExamController(IExamService examService) : ControllerBase
{
    [HttpGet("{consultationId:guid}")]
    public async Task<ActionResult<ConsultationExamResponse>> GetConsultationExam([FromRoute] Guid consultationId)
    {
        try
        {
            var cabinetIdentityId = User.GetCabinetIdentityId();
            var response = await examService.GetConsultationExam(consultationId, cabinetIdentityId);
            return Ok(response);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPatch("{consultationId:guid}")]
    public async Task<ActionResult<ConsultationExamResponse>> UpsertConsultationExam(
        [FromRoute] Guid consultationId,
        [FromBody] UpsertConsultationExamRequest request)
    {
        try
        {
            var cabinetIdentityId = User.GetCabinetIdentityId();
            var response = await examService.UpsertConsultationExam(consultationId, request, cabinetIdentityId);
            return Ok(response);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpGet("catalog/findings")]
    public async Task<ActionResult<List<ExamFindingCatalogItemResponse>>> GetFindingCatalog([FromQuery] string? section = null)
    {
        try
        {
            var cabinetIdentityId = User.GetCabinetIdentityId();
            var response = await examService.GetFindingCatalog(cabinetIdentityId, section);
            return Ok(response);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPost("catalog/findings")]
    public async Task<ActionResult<ExamFindingCatalogItemResponse>> AddFindingCatalogItem([FromBody] UpsertExamFindingCatalogItemRequest request)
    {
        try
        {
            var cabinetIdentityId = User.GetCabinetIdentityId();
            var response = await examService.AddFindingCatalogItem(cabinetIdentityId, request);
            return Ok(response);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }
}
