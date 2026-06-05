using api.Src.Smtp.Services;
using api.Src.Subscription.Entities;
using Microsoft.EntityFrameworkCore;

namespace api.Src.Subscription.Services;

public class SubscriptionService(AppDbContext db, ISmtpService smtpService, ILogger<SubscriptionService> logger) : ISubscriptionService
{
    public const int FileBatchSize = 1000;
    public async Task CleanDatabase()
    {
        await UpdateSubscriptionStatuses();
        await NotifyExpiringSubscriptions();
        await DeleteAccountsFlaggedForDeletion();
        await DeleteFiles();
    }

    private async Task UpdateSubscriptionStatuses()
    {
        var now = DateTime.UtcNow;
        var expiredSubscriptionQuery = db.ActiveSubscriptions
            .Where(s => s.CabinetIdentity != null && s.CabinetIdentity.IsActive && s.IsActive && s.EndDate <= now);

        await expiredSubscriptionQuery
            .ExecuteUpdateAsync(s => s
                .SetProperty(sub => sub.IsActive, false));

        var expiredCabinetIdentityIds = expiredSubscriptionQuery
            .Select(s => s.CabinetIdentityId);

        await db.CabinetIdentities
            .Where(ci => ci.IsActive && expiredCabinetIdentityIds.Contains(ci.Id))
            .ExecuteUpdateAsync(s => s
                .SetProperty(ci => ci.IsActive, false));
    }

    private async Task NotifyExpiringSubscriptions()
    {
        var oneMonthFromNow = DateTime.UtcNow.AddDays(7);

        var expiringSubscriptions = await db.ActiveSubscriptions
            .Include(s => s.CabinetIdentity)
            .Where(s =>
                s.IsActive &&
                !s.HasBeenNotifiedOfExpiration &&
                !s.CabinetIdentity!.Doctor!.Role.StartsWith("admin") &&
                s.EndDate > DateTime.UtcNow &&
                s.EndDate <= oneMonthFromNow)
            .ToListAsync();

        foreach (var sub in expiringSubscriptions)
        {
            var cabinet = sub.CabinetIdentity!;
            var doctor = cabinet.Doctor!;

            await smtpService.SendSubscriptionRenewalReminderEmailAsync(
                cabinet.Email,
                doctor.Firstname,
                doctor.Lastname,
                sub.EndDate,
                doctor.LanguagePreference ?? "fr"
            );

            sub.HasBeenNotifiedOfExpiration = true;
            sub.UpdatedAt = DateTime.UtcNow;

            logger.LogInformation(
                "Sent renewal reminder to {Email} for subscription {SubscriptionId} expiring on {EndDate}.",
                cabinet.Email, sub.Id, sub.EndDate);
        }

        await db.SaveChangesAsync();
    }

    private async Task DeleteAccountsFlaggedForDeletion()
    {
        var emails = await db.CabinetIdentities
    .Where(c => c.IsFlaggedForDeletion && c.FlaggedForDeletionAt.HasValue && c.FlaggedForDeletionAt.Value.AddMonths(3) <= DateTime.UtcNow)
    .Select(c => new { c.Email, c.ProfilePictureUrl })
    .ToListAsync();
        List<FileToDelete> filesToDelete = [.. emails.Where(e => e.ProfilePictureUrl != null).Select(e => new FileToDelete { FilePath = e.ProfilePictureUrl! })];
        await db.AddRangeAsync(filesToDelete);

        await db.CabinetIdentities
            .Where(c => c.IsFlaggedForDeletion && c.FlaggedForDeletionAt.HasValue && c.FlaggedForDeletionAt.Value.AddMonths(3) <= DateTime.UtcNow)
            .ExecuteDeleteAsync();

        logger.LogInformation("Deleted {Count} accounts: {Emails}", emails.Count, string.Join(", ", emails));
    }


    private async Task DeleteFiles()
    {
        var files = await db.FilesToDelete.Take(FileBatchSize).ToListAsync();
        foreach (var file in files)
        {
            try
            {
                if (File.Exists(file.FilePath))
                {
                    File.Delete(file.FilePath);
                    logger.LogInformation("Deleted file: {FilePath}", file.FilePath);
                }
                else
                {
                    logger.LogWarning("File not found for deletion: {FilePath}", file.FilePath);
                }
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error deleting file: {FilePath}", file.FilePath);
            }
        }

    }
}
