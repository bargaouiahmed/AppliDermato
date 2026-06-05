using System;
using System.Net;
using System.Net.Mail;
using api.Src.Configuration;

namespace api.Src.Smtp.Services;

public class SmtpService(PublicUrlSettings publicUrls) : ISmtpService
{
    private readonly string smtpHost = Environment.GetEnvironmentVariable("smtp_host") ?? throw new InvalidOperationException("SMTP_HOST environment variable is not set.");
    private readonly int smtpPort = int.Parse(Environment.GetEnvironmentVariable("smtp_port") ?? throw new InvalidOperationException("SMTP_PORT environment variable is not set."));
    private readonly string smtpUser = Environment.GetEnvironmentVariable("smtp_user") ?? throw new InvalidOperationException("SMTP_USER environment variable is not set.");
    private readonly string smtpPass = Environment.GetEnvironmentVariable("smtp_password") ?? throw new InvalidOperationException("SMTP_PASS environment variable is not set.");
    private readonly string fromEmail = Environment.GetEnvironmentVariable("smtp_from_email") ?? throw new InvalidOperationException("FROM_EMAIL environment variable is not set.");
    private readonly bool enableSsl = bool.Parse(Environment.GetEnvironmentVariable("smtp_secure") ?? "true");


    private readonly string brandName = Environment.GetEnvironmentVariable("brand_name") ?? "Generalisto";


    public async Task SendPasswordResetEmailAsync(string toEmail, string resetCode, string Firstname, string Lastname, string language = "fr")
    {
        using (var client = new SmtpClient(smtpHost, smtpPort))
        {
            client.EnableSsl = enableSsl;
            client.Timeout = 10000;
            client.Credentials = new NetworkCredential(smtpUser, smtpPass);

            // Select template based on language
            string templateFileName = language.ToLower() switch
            {
                "en" => "reset-password-template-en.html",
                "ar" => "reset-password-template-ar.html",
                _ => "reset-password-template.html" // default to French
            };

            var templatePath = Path.Combine(Directory.GetCurrentDirectory(), "Src", "Smtp", "Templates", templateFileName);
            string emailBody = await File.ReadAllTextAsync(templatePath);

            emailBody = emailBody.Replace("{{codeNumber1}}", resetCode[0].ToString()).Replace("{{codeNumber2}}", resetCode[1].ToString())
                                 .Replace("{{codeNumber3}}", resetCode[2].ToString())
                                 .Replace("{{codeNumber4}}", resetCode[3].ToString())
                                 .Replace("{{codeNumber5}}", resetCode[4].ToString())
                                 .Replace("{{codeNumber6}}", resetCode[5].ToString())
                                 .Replace("{{nom}}", $"{Firstname} {Lastname}")
                                 .Replace("{{year}}", DateTime.Now.Year.ToString())
                                 .Replace("{{brandName}}", brandName);
            emailBody = ApplyPublicUrlPlaceholders(emailBody);
            var mailMessage = new MailMessage
            {
                From = new MailAddress(fromEmail)
            };
            mailMessage.To.Add(toEmail);
            mailMessage.Subject = language.ToLower() switch
            {
                "en" => "Password Reset Code",
                "ar" => "رمز إعادة تعيين كلمة المرور",
                _ => "Code de réinitialisation de mot de passe"
            };
            mailMessage.Body = emailBody;
            mailMessage.IsBodyHtml = true;
            try
            {
                await client.SendMailAsync(mailMessage);
            }
            catch (SmtpException ex)
            {
                Console.WriteLine($"SMTP Error: {ex.StatusCode} - {ex.Message}");
                if (ex.InnerException != null)
                    Console.WriteLine($"Inner: {ex.InnerException.Message}");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error: {ex.GetType().Name} - {ex.Message}");
                if (ex.InnerException != null)
                    Console.WriteLine($"Inner: {ex.InnerException.Message}");
            }
        }

    }

    public async Task SendDoctorAccountCreatedEmailAsync(string toEmail, string temporaryPassword, string Firstname, string Lastname)
    {
        using (var client = new SmtpClient(smtpHost, smtpPort))
        {
            client.EnableSsl = enableSsl;
            client.Timeout = 10000;
            client.Credentials = new NetworkCredential(smtpUser, smtpPass);

            var templatePath = Path.Combine(Directory.GetCurrentDirectory(), "Src", "Smtp", "Templates", "doctor-account-created-template.html");
            string emailBody = await File.ReadAllTextAsync(templatePath);

            emailBody = emailBody.Replace("{{brandName}}", brandName)
                                 .Replace("{{nom}}", $"{Firstname} {Lastname}")
                                 .Replace("{{email}}", toEmail)
                                 .Replace("{{temporaryPassword}}", temporaryPassword)
                                 .Replace("{{year}}", DateTime.Now.Year.ToString());
            emailBody = ApplyPublicUrlPlaceholders(emailBody);

            var mailMessage = new MailMessage
            {
                From = new MailAddress(fromEmail),
                Subject = $"Votre compte sur {brandName}",
                Body = emailBody,
                IsBodyHtml = true
            };

            mailMessage.To.Add(toEmail);

            try
            {
                await client.SendMailAsync(mailMessage);
            }
            catch (SmtpException ex)
            {
                Console.WriteLine($"SMTP Error: {ex.StatusCode} - {ex.Message}");
                if (ex.InnerException != null)
                    Console.WriteLine($"Inner: {ex.InnerException.Message}");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error: {ex.GetType().Name} - {ex.Message}");
                if (ex.InnerException != null)
                    Console.WriteLine($"Inner: {ex.InnerException.Message}");
            }
        }
    }


    public async Task SendSubscriptionRenewalReminderEmailAsync(string toEmail, string Firstname, string Lastname, DateTime subscriptionEndDate, string language = "fr")
    {
        using (var client = new SmtpClient(smtpHost, smtpPort))
        {
            client.EnableSsl = enableSsl;
            client.Timeout = 10000;
            client.Credentials = new NetworkCredential(smtpUser, smtpPass);


            var templateFileName = language.ToLower() switch
            {
                "en" => "subscription-expiration-pending-template-en.html",
                "ar" => "subscription-expiration-pending-template-ar.html",
                _ => "subscription-expiration-pending-template.html"
            };
            var templatePath = Path.Combine(Directory.GetCurrentDirectory(), "Src", "Smtp", "Templates", templateFileName);
            string emailBody = await File.ReadAllTextAsync(templatePath);

            emailBody = emailBody.Replace("{{nom}}", $"{Firstname} {Lastname}")
                                 .Replace("{{subscriptionEndDate}}", subscriptionEndDate.ToString("MMMM dd, yyyy"))
                                 .Replace("{{year}}", DateTime.Now.Year.ToString())
                                 .Replace("{{brandName}}", brandName);
            emailBody = ApplyPublicUrlPlaceholders(emailBody);
            var mailMessage = new MailMessage
            {
                From = new MailAddress(fromEmail),
                Subject = language.ToLower() switch
                {
                    "en" => "Subscription Renewal Reminder",
                    "ar" => "تذكير تجديد الاشتراك",
                    _ => "Rappel de renouvellement d'abonnement"
                },
                Body = emailBody,
                IsBodyHtml = true
            };
            mailMessage.To.Add(toEmail);

            try
            {
                await client.SendMailAsync(mailMessage);
            }
            catch (SmtpException ex)
            {
                Console.WriteLine($"SMTP Error: {ex.StatusCode} - {ex.Message}");
                if (ex.InnerException != null)
                    Console.WriteLine($"Inner: {ex.InnerException.Message}");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error: {ex.GetType().Name} - {ex.Message}");
                if (ex.InnerException != null)
                    Console.WriteLine($"Inner: {ex.InnerException.Message}");
            }
        }
    }

    public async Task SendTechAssistanceEscalationEmailAsync(
        string toEmail,
        string ticketSubject,
        string requesterName,
        string requesterEmail,
        string issuePreview,
        string reviewUrl,
        DateTime createdAt)
    {
        using (var client = new SmtpClient(smtpHost, smtpPort))
        {
            client.EnableSsl = enableSsl;
            client.Timeout = 10000;
            client.Credentials = new NetworkCredential(smtpUser, smtpPass);

            var safeSubject = WebUtility.HtmlEncode(ticketSubject);
            var safeRequesterName = WebUtility.HtmlEncode(requesterName);
            var safeRequesterEmail = WebUtility.HtmlEncode(requesterEmail);
            var safeIssuePreview = WebUtility.HtmlEncode(TrimPreview(issuePreview));
            var safeReviewUrl = WebUtility.HtmlEncode(reviewUrl);
            var safeCreatedAt = WebUtility.HtmlEncode(createdAt.ToString("yyyy-MM-dd HH:mm 'UTC'"));

            var emailBody = $"""
                <!doctype html>
                <html>
                <body style="font-family: Arial, sans-serif; color: #1f2933; line-height: 1.5;">
                  <h2 style="margin: 0 0 16px;">Tech assistance request</h2>
                  <p>A support conversation has been escalated for technical review.</p>
                  <table cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; max-width: 680px;">
                    <tr>
                      <td style="border: 1px solid #d7dde5; font-weight: 700;">Subject</td>
                      <td style="border: 1px solid #d7dde5;">{safeSubject}</td>
                    </tr>
                    <tr>
                      <td style="border: 1px solid #d7dde5; font-weight: 700;">Requester</td>
                      <td style="border: 1px solid #d7dde5;">{safeRequesterName} &lt;{safeRequesterEmail}&gt;</td>
                    </tr>
                    <tr>
                      <td style="border: 1px solid #d7dde5; font-weight: 700;">Created at</td>
                      <td style="border: 1px solid #d7dde5;">{safeCreatedAt}</td>
                    </tr>
                    <tr>
                      <td style="border: 1px solid #d7dde5; font-weight: 700;">Issue preview</td>
                      <td style="border: 1px solid #d7dde5; white-space: pre-wrap;">{safeIssuePreview}</td>
                    </tr>
                  </table>
                  <p style="margin-top: 18px;">
                    <a href="{safeReviewUrl}" style="background: #1967d2; color: #ffffff; padding: 11px 16px; border-radius: 6px; text-decoration: none; font-weight: 700;">
                      Open read-only review
                    </a>
                  </p>
                  <p style="color: #667085; font-size: 13px;">Use the configured tech lead review password to open the conversation.</p>
                </body>
                </html>
                """;

            var mailMessage = new MailMessage
            {
                From = new MailAddress(fromEmail),
                Subject = $"Tech assistance: {ticketSubject}",
                Body = emailBody,
                IsBodyHtml = true
            };
            mailMessage.To.Add(toEmail);

            try
            {
                await client.SendMailAsync(mailMessage);
            }
            catch (SmtpException ex)
            {
                Console.WriteLine($"SMTP Error: {ex.StatusCode} - {ex.Message}");
                if (ex.InnerException != null)
                    Console.WriteLine($"Inner: {ex.InnerException.Message}");
                throw;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error: {ex.GetType().Name} - {ex.Message}");
                if (ex.InnerException != null)
                    Console.WriteLine($"Inner: {ex.InnerException.Message}");
                throw;
            }
        }
    }

    private string ApplyPublicUrlPlaceholders(string emailBody)
    {
        return emailBody
            .Replace("{{frontendUrl}}", publicUrls.FrontendUrl)
            .Replace("{{loginUrl}}", publicUrls.LoginUrl)
            .Replace("{{resetPasswordUrl}}", publicUrls.ResetPasswordUrl)
            .Replace("{{apiUrl}}", publicUrls.ApiUrl);
    }

    private static string TrimPreview(string value)
    {
        var normalized = (value ?? string.Empty).Trim();
        return normalized.Length <= 1200
            ? normalized
            : $"{normalized[..1200].TrimEnd()}...";
    }


}
