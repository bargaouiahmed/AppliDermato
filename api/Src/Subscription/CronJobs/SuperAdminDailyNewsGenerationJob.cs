using api.Src.Subscription.Services;
using Quartz;

namespace api.Src.Subscription.CronJobs;

public sealed class SuperAdminDailyNewsGenerationJob(
    IAutoDailyNewsService autoDailyNewsService,
    ILogger<SuperAdminDailyNewsGenerationJob> logger) : IJob
{
    public async Task Execute(IJobExecutionContext context)
    {
        try
        {
            await autoDailyNewsService.GenerateSuperAdminDailyNewsAsync(context.CancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[AUTO_DAILY_NEWS] generation_job_failed");
        }
    }
}

