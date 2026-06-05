using api.Src.Auth.Helpers;
using api.Src.ConsultationSpace.ConduiteSection.Dtos.Requests;
using api.Src.ConsultationSpace.ConduiteSection.Dtos.Responses;
using api.Src.ConsultationSpace.ConduiteSection.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace api.Src.ConsultationSpace.ConduiteSection.Controllers;

[Route("api/v0/conduite/consultations")]
[ApiController]
[Authorize(Roles = "secretary,doctor,admin,super_admin")]
public class ConduiteController(
    IConduiteService conduiteService,
    IConduitePrintService conduitePrintService,
    IConsultationLettreConfrereAiService lettreConfrereAiService)
    : ControllerBase
{
    [HttpGet("catalog/actions")]
    public async Task<ActionResult<List<ConduiteCatalogItemResponse>>> GetActionCatalog()
    {
        try
        {
            var response = await conduiteService.GetConduiteCatalog();
            return Ok(response);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpGet("catalog/consignes")]
    public async Task<ActionResult<List<string>>> GetConsigneCatalog()
    {
        try
        {
            var cabinetIdentityId = User.GetCabinetIdentityId();
            var response = await conduiteService.GetConsigneCatalog(cabinetIdentityId);
            return Ok(response);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpGet("catalog/ordonnance-types")]
    public async Task<ActionResult<List<ConduiteOrdonnanceTypeCatalogItemResponse>>> GetOrdonnanceTypeCatalog()
    {
        try
        {
            var cabinetIdentityId = User.GetCabinetIdentityId();
            var response = await conduiteService.GetOrdonnanceTypeCatalog(cabinetIdentityId);
            return Ok(response);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpGet("{consultationId:guid}")]
    public async Task<ActionResult<ConsultationConduiteResponse>> GetConsultationConduite([FromRoute] Guid consultationId)
    {
        try
        {
            var cabinetIdentityId = User.GetCabinetIdentityId();
            var response = await conduiteService.GetConsultationConduite(consultationId, cabinetIdentityId);
            return Ok(response);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpGet("{consultationId:guid}/ordonnance/latest")]
    public async Task<ActionResult<ConsultationConduiteActionResponse?>> GetLatestPreviousOrdonnance(
        [FromRoute] Guid consultationId)
    {
        try
        {
            var cabinetIdentityId = User.GetCabinetIdentityId();
            var response = await conduiteService.GetLatestPreviousOrdonnance(consultationId, cabinetIdentityId);
            return Ok(response);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPatch("{consultationId:guid}")]
    public async Task<ActionResult<ConsultationConduiteResponse>> UpsertConsultationConduite(
        [FromRoute] Guid consultationId,
        [FromBody] UpsertConsultationConduiteRequest request)
    {
        try
        {
            var cabinetIdentityId = User.GetCabinetIdentityId();
            var response = await conduiteService.UpsertConsultationConduite(consultationId, request, cabinetIdentityId);
            return Ok(response);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPost("catalog/ordonnance-types")]
    public async Task<ActionResult<ConduiteOrdonnanceTypeCatalogItemResponse>> SaveOrdonnanceTypeCatalogItem(
        [FromBody] SaveOrdonnanceTypeCatalogItemRequest request)
    {
        try
        {
            var cabinetIdentityId = User.GetCabinetIdentityId();
            var response = await conduiteService.SaveOrdonnanceTypeCatalogItem(cabinetIdentityId, request);
            return Ok(response);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPost("{consultationId:guid}/lettre-confrere/ai/generate")]
    public async Task<ActionResult<LettreConfrereAiJobResponse>> GenerateLettreConfrereWithAi(
        [FromRoute] Guid consultationId,
        [FromBody] GenerateLettreConfrereAiRequest request)
    {
        try
        {
            var cabinetIdentityId = User.GetCabinetIdentityId();
            var response = await lettreConfrereAiService.EnqueueGenerateAsync(
                consultationId,
                cabinetIdentityId,
                request);
            return Accepted(response);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPost("{consultationId:guid}/lettre-confrere/ai/correct")]
    public async Task<ActionResult<LettreConfrereAiJobResponse>> CorrectLettreConfrereWithAi(
        [FromRoute] Guid consultationId,
        [FromBody] CorrectLettreConfrereAiRequest request)
    {
        try
        {
            var cabinetIdentityId = User.GetCabinetIdentityId();
            var response = await lettreConfrereAiService.EnqueueCorrectAsync(
                consultationId,
                cabinetIdentityId,
                request);
            return Accepted(response);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpGet("{consultationId:guid}/lettre-confrere/ai/jobs/{jobId:guid}")]
    public async Task<ActionResult<LettreConfrereAiJobResponse>> GetLettreConfrereAiJob(
        [FromRoute] Guid consultationId,
        [FromRoute] Guid jobId)
    {
        try
        {
            var cabinetIdentityId = User.GetCabinetIdentityId();
            var response = await lettreConfrereAiService.GetJobAsync(
                consultationId,
                cabinetIdentityId,
                jobId);
            return Ok(response);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpGet("{consultationId:guid}/print/{documentType}")]
    public async Task<ActionResult<PrintableConduiteDocumentResponse>> PrintConsultationDocument(
        [FromRoute] Guid consultationId,
        [FromRoute] string documentType,
        [FromQuery] string? sections = null,
        [FromQuery] string? lang = null)
    {
        try
        {
            var cabinetIdentityId = User.GetCabinetIdentityId();
            var parsedSections = string.IsNullOrWhiteSpace(sections)
                ? null
                : sections.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            var response = await conduitePrintService.GeneratePrintableDocument(
                consultationId,
                documentType,
                cabinetIdentityId,
                parsedSections,
                lang);
            return Ok(response);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpGet("{consultationId:guid}/print/cnam/data")]
    public async Task<ActionResult<CnamPrintDataResponse>> GetCnamPrintData([FromRoute] Guid consultationId)
    {
        try
        {
            var cabinetIdentityId = User.GetCabinetIdentityId();
            var response = await conduitePrintService.GetCnamPrintData(consultationId, cabinetIdentityId);
            return Ok(response);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPost("{consultationId:guid}/print/paraclinique/pdf")]
    public async Task<IActionResult> PrintParacliniquePdf(
        [FromRoute] Guid consultationId,
        [FromBody] GenerateParacliniquePdfRequest? request,
        [FromQuery] string? lang = null)
    {
        try
        {
            var cabinetIdentityId = User.GetCabinetIdentityId();
            var pdfBytes = await conduitePrintService.GenerateParacliniquePdf(
                consultationId,
                cabinetIdentityId,
                request?.Sections,
                lang);

            var fileName = $"paraclinique_{consultationId:N}.pdf";
            return File(pdfBytes, "application/pdf", fileName);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }
}
