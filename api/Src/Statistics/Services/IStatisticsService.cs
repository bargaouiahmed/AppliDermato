using api.Src.Statistics.Dtos;

namespace api.Src.Statistics.Services;

public interface IStatisticsService
{
    Task<StatisticsOverviewResponse> GetOverview(Guid cabinetIdentityId, StatisticsOverviewRequest request);
    Task<List<string>> GetDiagnosticsCatalog(Guid cabinetIdentityId);
}
