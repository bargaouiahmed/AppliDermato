using System;
using api.Src.Subscription.Services;
using Quartz;

namespace api.Src.Subscription.CronJobs;

public class CleanUpJob(ISubscriptionService subscriptionService, ILogger<CleanUpJob> logger) : IJob
{

    public async Task Execute(IJobExecutionContext context)
    {
        try
        {
            await subscriptionService.CleanDatabase();
        }
        catch (Exception ex)
        {
            // Log the exception (you can use your preferred logging framework)
            logger.LogError(ex, "An error occurred while executing the CleanUpJob");
        }
    }

}
