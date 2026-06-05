using api.Src.Auth.Helpers;
using api.Src.Statistics.Dtos;
using api.Src.Statistics.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace api.Src.Statistics.Controllers;

[Route("api/v0/statistics")]
[ApiController]
[Authorize]
public class StatisticsController(IStatisticsService statisticsService) : ControllerBase
{
    [HttpGet("diagnostics")]
    public async Task<ActionResult<List<string>>> GetDiagnosticsCatalog()
    {
        try
        {
            var cabinetIdentityId = User.GetCabinetIdentityId();
            var response = await statisticsService.GetDiagnosticsCatalog(cabinetIdentityId);
            return Ok(response);
        }
        catch (Exception ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }

    [HttpGet("overview")]
    public async Task<ActionResult<StatisticsOverviewResponse>> GetOverview([FromQuery] StatisticsOverviewRequest request)
    {
        try
        {
            var cabinetIdentityId = User.GetCabinetIdentityId();
            var response = await statisticsService.GetOverview(cabinetIdentityId, request);
            return Ok(response);
        }
        catch (Exception ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }
}
