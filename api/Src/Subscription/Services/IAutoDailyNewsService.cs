namespace api.Src.Subscription.Services;

public interface IAutoDailyNewsService
{
    Task GenerateSuperAdminDailyNewsAsync(CancellationToken cancellationToken = default);
    Task PropagateSuperAdminDailyNewsAsync(string? previousSourceFr = null, CancellationToken cancellationToken = default);
}
