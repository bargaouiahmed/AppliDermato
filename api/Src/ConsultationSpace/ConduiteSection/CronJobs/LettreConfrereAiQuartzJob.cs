using api.Src.ConsultationSpace.ConduiteSection.Services;
using Quartz;

namespace api.Src.ConsultationSpace.ConduiteSection.CronJobs;

public sealed class LettreConfrereAiQuartzJob(
    IConsultationLettreConfrereAiService lettreConfrereAiService,
    ILogger<LettreConfrereAiQuartzJob> logger) : IJob
{
    public async Task Execute(IJobExecutionContext context)
    {
        var rawJobId = context.MergedJobDataMap.GetString("jobId");
        if (!Guid.TryParse(rawJobId, out var jobId))
        {
            logger.LogWarning("[LETTRE_AI] invalid_job_id value={JobId}", rawJobId);
            return;
        }

        await lettreConfrereAiService.ProcessJobAsync(jobId, context.CancellationToken);
    }
}
