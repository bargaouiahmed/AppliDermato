using api.Src.Subscription.Services;
using Quartz;

namespace api.Src.Subscription.CronJobs;

public sealed class SuperAdminDailyNewsPropagationJob(
    IAutoDailyNewsService autoDailyNewsService,
    ILogger<SuperAdminDailyNewsPropagationJob> logger) : IJob
{
    public async Task Execute(IJobExecutionContext context)
    {
        try
        {
            var previousSourceFr = context.MergedJobDataMap.GetString("PreviousSourceFr");
            await autoDailyNewsService.PropagateSuperAdminDailyNewsAsync(previousSourceFr, context.CancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[AUTO_DAILY_NEWS] propagation_job_failed");
        }
    }
}
