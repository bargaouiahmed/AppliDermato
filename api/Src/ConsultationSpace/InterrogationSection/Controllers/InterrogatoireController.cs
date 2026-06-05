using api.Src.Auth.Helpers;
using api.Src.ConsultationSpace.InterrogationSection.Dtos.Requests;
using api.Src.ConsultationSpace.InterrogationSection.Dtos.Responses;
using api.Src.ConsultationSpace.InterrogationSection.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace api.Src.ConsultationSpace.InterrogationSection.Controllers;

[Route("api/v0/interrogatoire/consultations")]
[ApiController]
[Authorize]
public class InterrogatoireController(IInterrogatoireService interrogatoireService) : ControllerBase
{
    [HttpPost("initialize")]
    public async Task<ActionResult<ConsultationInterrogatoireResponse>> InitializeConsultation([FromBody] InitializeConsultationRequest request)
    {
        try
        {
            var cabinetIdentityId = User.GetCabinetIdentityId();
            var response = await interrogatoireService.InitializeConsultation(request, cabinetIdentityId);
            return Ok(response);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpGet("{consultationId:guid}")]
    public async Task<ActionResult<ConsultationInterrogatoireResponse>> GetConsultationInterrogatoire([FromRoute] Guid consultationId)
    {
        try
        {
            var cabinetIdentityId = User.GetCabinetIdentityId();
            var response = await interrogatoireService.GetConsultationInterrogatoire(consultationId, cabinetIdentityId);
            return Ok(response);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpGet("{consultationId:guid}/ordonnances/history")]
    public async Task<ActionResult<List<InterrogatoireOrdonnanceHistoryResponse>>> GetPreviousOrdonnanceHistory([FromRoute] Guid consultationId)
    {
        try
        {
            var cabinetIdentityId = User.GetCabinetIdentityId();
            var response = await interrogatoireService.GetPreviousOrdonnanceHistory(consultationId, cabinetIdentityId);
            return Ok(response);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpGet("anomalies/catalog")]
    public async Task<ActionResult<List<InterrogatoireAnomalyCatalogItemResponse>>> GetAnomalyCatalog([FromQuery] string? section = null)
    {
        try
        {
            var cabinetIdentityId = User.GetCabinetIdentityId();
            var response = await interrogatoireService.GetAnomalyCatalog(cabinetIdentityId, section);
            return Ok(response);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpDelete("anomalies/catalog/custom")]
    public async Task<ActionResult> HideCustomAnomalyFromCatalog([FromQuery] string section, [FromQuery] string label)
    {
        try
        {
            var cabinetIdentityId = User.GetCabinetIdentityId();
            await interrogatoireService.HideCustomAnomalyFromCatalog(cabinetIdentityId, section, label);
            return Ok(new { Message = "Custom anomaly hidden from catalog." });
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPost("anomalies/catalog/custom")]
    public async Task<ActionResult<InterrogatoireAnomalyCatalogItemResponse>> AddCustomAnomalyToCatalog([FromBody] UpsertAnomalyCatalogCustomRequest request)
    {
        try
        {
            var cabinetIdentityId = User.GetCabinetIdentityId();
            var response = await interrogatoireService.AddCustomAnomalyToCatalog(cabinetIdentityId, request);
            return Ok(response);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpGet("treatments/catalog/medicines")]
    public async Task<ActionResult<List<TreatmentCatalogItemResponse>>> GetTreatmentMedicineCatalog()
    {
        try
        {
            var cabinetIdentityId = User.GetCabinetIdentityId();
            var response = await interrogatoireService.GetTreatmentMedicineCatalog(cabinetIdentityId);
            return Ok(response);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPost("treatments/catalog/medicines")]
    public async Task<ActionResult<TreatmentCatalogItemResponse>> AddTreatmentMedicineCatalogItem([FromBody] UpsertTreatmentCatalogItemRequest request)
    {
        try
        {
            var cabinetIdentityId = User.GetCabinetIdentityId();
            var response = await interrogatoireService.AddTreatmentMedicineCatalogItem(cabinetIdentityId, request);
            return Ok(response);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpGet("treatments/catalog/therapeutic-classes")]
    public async Task<ActionResult<List<TreatmentCatalogItemResponse>>> GetTherapeuticClassCatalog()
    {
        try
        {
            var cabinetIdentityId = User.GetCabinetIdentityId();
            var response = await interrogatoireService.GetTherapeuticClassCatalog(cabinetIdentityId);
            return Ok(response);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPost("treatments/catalog/therapeutic-classes")]
    public async Task<ActionResult<TreatmentCatalogItemResponse>> AddTherapeuticClassCatalogItem([FromBody] UpsertTreatmentCatalogItemRequest request)
    {
        try
        {
            var cabinetIdentityId = User.GetCabinetIdentityId();
            var response = await interrogatoireService.AddTherapeuticClassCatalogItem(cabinetIdentityId, request);
            return Ok(response);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpGet("treatments/catalog/categories")]
    public async Task<ActionResult<List<TreatmentCatalogItemResponse>>> GetTreatmentCategoryCatalog()
    {
        try
        {
            var cabinetIdentityId = User.GetCabinetIdentityId();
            var response = await interrogatoireService.GetTreatmentCategoryCatalog(cabinetIdentityId);
            return Ok(response);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpGet("treatments/catalog/relations")]
    public async Task<ActionResult<List<TreatmentCatalogRelationResponse>>> GetTreatmentCatalogRelations()
    {
        try
        {
            var cabinetIdentityId = User.GetCabinetIdentityId();
            var response = await interrogatoireService.GetTreatmentCatalogRelations(cabinetIdentityId);
            return Ok(response);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpGet("{consultationId:guid}/diagnostics/catalog")]
    public async Task<ActionResult<List<string>>> GetDiagnosticsCatalog([FromRoute] Guid consultationId)
    {
        try
        {
            var cabinetIdentityId = User.GetCabinetIdentityId();
            var response = await interrogatoireService.GetDiagnosticsCatalog(consultationId, cabinetIdentityId);
            return Ok(response);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPost("treatments/catalog/categories")]
    public async Task<ActionResult<TreatmentCatalogItemResponse>> AddTreatmentCategoryCatalogItem([FromBody] UpsertTreatmentCatalogItemRequest request)
    {
        try
        {
            var cabinetIdentityId = User.GetCabinetIdentityId();
            var response = await interrogatoireService.AddTreatmentCategoryCatalogItem(cabinetIdentityId, request);
            return Ok(response);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPatch("{consultationId:guid}/timer")]
    public async Task<ActionResult> UpdateConsultationTimer([FromRoute] Guid consultationId, [FromBody] UpdateConsultationTimerRequest request)
    {
        try
        {
            var cabinetIdentityId = User.GetCabinetIdentityId();
            await interrogatoireService.UpdateConsultationTimer(consultationId, request, cabinetIdentityId);
            return Ok(new { Message = "Consultation timer updated successfully." });
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPatch("{consultationId:guid}")]
    public async Task<ActionResult> UpdateConsultationData([FromRoute] Guid consultationId, [FromBody] UpdateConsultationDataRequest request)
    {
        try
        {
            var cabinetIdentityId = User.GetCabinetIdentityId();
            await interrogatoireService.UpdateConsultationData(consultationId, request, cabinetIdentityId);
            return Ok(new { Message = "Consultation data updated successfully." });
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpDelete("{consultationId:guid}")]
    public async Task<ActionResult> DeleteConsultation([FromRoute] Guid consultationId)
    {
        try
        {
            var cabinetIdentityId = User.GetCabinetIdentityId();
            await interrogatoireService.DeleteConsultation(consultationId, cabinetIdentityId);
            return Ok(new { Message = "Consultation deleted successfully." });
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }
}
