using api.Src.Auth.Helpers;
using api.Src.PatientSpace.Dtos.requests;
using api.Src.PatientSpace.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Globalization;

namespace api.Src.PatientSpace.Controllers
{
    [Route("api/v0/patients")]
    [ApiController]
    [Authorize]
    public class PatientController(IPatientService patientService) : ControllerBase
    {
        [HttpPost]
        public async Task<ActionResult> AddPatient([FromBody] AddPatientRequest request)
        {
            try
            {
                var cabinetIdentityId = User.GetCabinetIdentityId();
                await patientService.AddPatient(request, cabinetIdentityId);
                return Ok(new { Message = "Patient added successfully" });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { Message = ex.Message });
            }
            catch (Exception)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, new { Message = "Unexpected error while adding patient." });
            }
        }
        [HttpGet("{id:guid}")]
        public async Task<ActionResult> GetPatientById([FromRoute] Guid id)
        {
            try
            {
                var cabinetIdentityId = User.GetCabinetIdentityId();
                var result = await patientService.GetPatientById(id, cabinetIdentityId);
                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }
        [HttpPut("{id:guid}")]
        public async Task<ActionResult> UpdatePatient([FromRoute] Guid id, [FromBody] UpdatePateinetRequest request)
        {
            try
            {
                var cabinetIdentityId = User.GetCabinetIdentityId();
                await patientService.UpdatePatient(id, request, cabinetIdentityId);
                return Ok(new { Message = "Patient updated successfully" });
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }
        [HttpDelete("{id:guid}")]
        public async Task<ActionResult> DeletePatient([FromRoute] Guid id)
        {
            try
            {
                var cabinetIdentityId = User.GetCabinetIdentityId();
                await patientService.DeletePatient(id, cabinetIdentityId);
                return Ok(new { Message = "Patient deleted successfully" });
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }
        [HttpGet("all")]
        public async Task<ActionResult> GetAllPatientsForCabinet([FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 10, [FromQuery] string? searchQuery = null, [FromQuery] string? dateOfBirth = null, [FromQuery] string? sortBy = null, [FromQuery] string? sortDirection = null, [FromQuery] int? dossierNumber = null, [FromQuery] string? phoneNumber = null, [FromQuery] string? name = null, [FromQuery] string? email = null, [FromQuery] string? firstname = null, [FromQuery] string? lastname = null, [FromQuery] int? age = null)
        {
            try
            {
                var cabinetIdentityId = User.GetCabinetIdentityId();
                var result = await patientService.GetAllPatientsForCabinet(cabinetIdentityId, pageNumber, pageSize, searchQuery, dateOfBirth, sortBy, sortDirection, dossierNumber, phoneNumber, name, email, firstname, lastname, age);
                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpGet("professions")]
        public async Task<ActionResult> GetPatientProfessions([FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 25, [FromQuery] string? searchQuery = null)
        {
            try
            {
                var cabinetIdentityId = User.GetCabinetIdentityId();
                var result = await patientService.GetPatientProfessions(cabinetIdentityId, pageNumber, pageSize, searchQuery);
                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpGet("recent")]
        public async Task<ActionResult> GetRecentPatients([FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 10)
        {
            try
            {
                var cabinetIdentityId = User.GetCabinetIdentityId();
                var result = await patientService.GetRecentPatientsForCabinet(cabinetIdentityId, pageNumber, pageSize);
                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpPost("verify-dossier-number")]
        public async Task<ActionResult> VerifyDossierNumber([FromBody] VerifyPatientDossierNumberRequest request)
        {
            try
            {
                var cabinetIdentityId = User.GetCabinetIdentityId();
                var result = await patientService.VerifyPatientDossierNumber(cabinetIdentityId, request.DossierNumber);
                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpGet("export/csv")]
        public async Task<ActionResult> ExportPatientsCsv([FromQuery] string? searchQuery = null, [FromQuery] string? dateOfBirth = null, [FromQuery] int? dossierNumber = null, [FromQuery] string? phoneNumber = null, [FromQuery] string? name = null, [FromQuery] string? email = null, [FromQuery] string? firstname = null, [FromQuery] string? lastname = null, [FromQuery] int? age = null)
        {
            try
            {
                var cabinetIdentityId = User.GetCabinetIdentityId();
                var csvBytes = await patientService.ExportPatientsCsv(cabinetIdentityId, searchQuery, dateOfBirth, dossierNumber, phoneNumber, name, email, firstname, lastname, age);
                var fileName = $"patients-{DateTime.UtcNow:yyyyMMdd-HHmmss}.csv";
                return File(csvBytes, "text/csv", fileName);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpGet("next-dossier-number")]
        public async Task<ActionResult> GetNextDossierNumber()
        {
            try
            {
                var cabinetIdentityId = User.GetCabinetIdentityId();
                var result = await patientService.GetNextPatientDossierNumber(cabinetIdentityId);
                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpGet("{id}/consultations")]
        public async Task<ActionResult> GetPatientConsultations([FromRoute] string id, [FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 10)
        {
            try
            {
                if(!Guid.TryParse(id, out var patientId))
                {
                    return BadRequest("Invalid patient ID format");
                }
                var cabinetIdentityId = User.GetCabinetIdentityId();
                var result = await patientService.GetPatientConsultations(patientId, cabinetIdentityId, pageNumber, pageSize);
                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpGet("consultations/by-date")]
        public async Task<ActionResult> GetConsultationsByDate([FromQuery] string? date = null)
        {
            try
            {
                var cabinetIdentityId = User.GetCabinetIdentityId();
                var targetDate = DateTime.UtcNow.Date;

                if (!string.IsNullOrWhiteSpace(date))
                {
                    if (!DateTime.TryParseExact(
                        date.Trim(),
                        "yyyy-MM-dd",
                        CultureInfo.InvariantCulture,
                        DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal,
                        out var parsedDate))
                    {
                        return BadRequest(new { Message = "Invalid date format. Use yyyy-MM-dd." });
                    }

                    targetDate = parsedDate.Date;
                }

                var consultations = await patientService.GetConsultationsByDate(cabinetIdentityId, targetDate);
                return Ok(new
                {
                    date = targetDate.ToString("yyyy-MM-dd"),
                    consultations,
                    totalCount = consultations.Count
                });
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpGet("consultations/dates")]
        public async Task<ActionResult> GetConsultationDates([FromQuery] int? year = null, [FromQuery] int? month = null)
        {
            try
            {
                var cabinetIdentityId = User.GetCabinetIdentityId();
                var now = DateTime.UtcNow;
                var targetYear = year ?? now.Year;
                var targetMonth = month ?? now.Month;

                if (targetMonth < 1 || targetMonth > 12)
                {
                    return BadRequest(new { Message = "Month must be between 1 and 12." });
                }

                var dates = await patientService.GetConsultationDates(cabinetIdentityId, targetYear, targetMonth);
                return Ok(new
                {
                    year = targetYear,
                    month = targetMonth,
                    dates,
                    totalCount = dates.Count
                });
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }
    }
}
