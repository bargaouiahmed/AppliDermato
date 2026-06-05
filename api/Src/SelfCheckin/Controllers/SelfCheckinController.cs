using api.Src.SelfCheckin.Dtos;
using api.Src.SelfCheckin.Services;
using api.Src.ConsultationSpace.InterrogationSection.Dtos.Responses;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace api.Src.SelfCheckin.Controllers;

[Route("api/v0/self-checkin/{doctorId:guid}/{kioskKey}")]
[ApiController]
[AllowAnonymous]
public class SelfCheckinController(ISelfCheckinService selfCheckinService) : ControllerBase
{
    [HttpGet("bootstrap")]
    public async Task<ActionResult<SelfCheckinBootstrapResponse>> GetBootstrap(
        [FromRoute] Guid doctorId,
        [FromRoute] string kioskKey)
    {
        try
        {
            var doctorContext = await selfCheckinService.ValidateDoctorContext(doctorId, kioskKey);
            var bootstrap = await selfCheckinService.GetBootstrap(doctorContext);
            return Ok(bootstrap);
        }
        catch (Exception ex)
        {
            return ToErrorResult(ex);
        }
    }

    [HttpGet("patient/next-dossier-number")]
    public async Task<ActionResult<object>> GetNextDossierNumber(
        [FromRoute] Guid doctorId,
        [FromRoute] string kioskKey)
    {
        try
        {
            var doctorContext = await selfCheckinService.ValidateDoctorContext(doctorId, kioskKey);
            var nextDossierNumber = await selfCheckinService.GetNextDossierNumber(doctorContext);
            return Ok(new { nextDossierNumber });
        }
        catch (Exception ex)
        {
            return ToErrorResult(ex);
        }
    }

    [HttpPost("patient/find")]
    public async Task<ActionResult<object>> FindPatient(
        [FromRoute] Guid doctorId,
        [FromRoute] string kioskKey,
        [FromBody] SelfCheckinFindPatientRequest request)
    {
        try
        {
            var doctorContext = await selfCheckinService.ValidateDoctorContext(doctorId, kioskKey);
            var results = await selfCheckinService.FindPatients(doctorContext, request);
            return Ok(new { results });
        }
        catch (Exception ex)
        {
            return ToErrorResult(ex);
        }
    }

    [HttpPost("patient/create")]
    public async Task<ActionResult<object>> CreatePatient(
        [FromRoute] Guid doctorId,
        [FromRoute] string kioskKey,
        [FromBody] SelfCheckinCreatePatientRequest request)
    {
        try
        {
            var doctorContext = await selfCheckinService.ValidateDoctorContext(doctorId, kioskKey);
            var patient = await selfCheckinService.CreatePatient(doctorContext, request);
            return StatusCode(StatusCodes.Status201Created, new { patient });
        }
        catch (Exception ex)
        {
            return ToErrorResult(ex);
        }
    }

    [HttpPost("consultation/create")]
    public async Task<ActionResult<SelfCheckinCreateConsultationResponse>> CreateConsultation(
        [FromRoute] Guid doctorId,
        [FromRoute] string kioskKey,
        [FromBody] SelfCheckinCreateConsultationRequest request)
    {
        try
        {
            var doctorContext = await selfCheckinService.ValidateDoctorContext(doctorId, kioskKey);
            var response = await selfCheckinService.CreateOrReuseConsultation(doctorContext, request);
            return Ok(response);
        }
        catch (Exception ex)
        {
            return ToErrorResult(ex);
        }
    }

    [HttpPatch("consultation/{consultationId:guid}/motif")]
    public async Task<ActionResult<object>> PatchMotif(
        [FromRoute] Guid doctorId,
        [FromRoute] string kioskKey,
        [FromRoute] Guid consultationId,
        [FromBody] SelfCheckinPatchMotifRequest request)
    {
        try
        {
            var doctorContext = await selfCheckinService.ValidateDoctorContext(doctorId, kioskKey);
            var motifs = await selfCheckinService.PatchMotifs(doctorContext, consultationId, request);
            return Ok(new { consultationId, motifs });
        }
        catch (Exception ex)
        {
            return ToErrorResult(ex);
        }
    }

    [HttpPatch("consultation/{consultationId:guid}/interrogatoire")]
    public async Task<ActionResult<ConsultationInterrogatoireResponse>> PatchInterrogatoire(
        [FromRoute] Guid doctorId,
        [FromRoute] string kioskKey,
        [FromRoute] Guid consultationId,
        [FromBody] SelfCheckinPatchInterrogatoireRequest request)
    {
        try
        {
            var doctorContext = await selfCheckinService.ValidateDoctorContext(doctorId, kioskKey);
            var response = await selfCheckinService.PatchInterrogatoire(doctorContext, consultationId, request);
            return Ok(response);
        }
        catch (Exception ex)
        {
            return ToErrorResult(ex);
        }
    }

    private ActionResult ToErrorResult(Exception exception)
    {
        if (exception is SelfCheckinException selfCheckinException)
        {
            return StatusCode(
                selfCheckinException.StatusCode,
                new SelfCheckinErrorResponse
                {
                    Code = selfCheckinException.Code,
                    Message = selfCheckinException.Message,
                });
        }

        return StatusCode(
            StatusCodes.Status500InternalServerError,
            new SelfCheckinErrorResponse
            {
                Code = "SELF_CHECKIN_ERROR",
                Message = "Unexpected server error.",
            });
    }
}
