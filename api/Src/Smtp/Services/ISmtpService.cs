using System;

namespace api.Src.Smtp.Services;

public interface ISmtpService
{
    public Task SendPasswordResetEmailAsync(string toEmail, string resetCode, string Firstname, string Lastname, string language = "fr");
    public Task SendSubscriptionRenewalReminderEmailAsync(string toEmail, string Firstname, string Lastname, DateTime subscriptionEndDate, string language = "fr");
    public Task SendDoctorAccountCreatedEmailAsync(string toEmail, string temporaryPassword, string Firstname, string Lastname);
    public Task SendTechAssistanceEscalationEmailAsync(
        string toEmail,
        string ticketSubject,
        string requesterName,
        string requesterEmail,
        string issuePreview,
        string reviewUrl,
        DateTime createdAt);

}
