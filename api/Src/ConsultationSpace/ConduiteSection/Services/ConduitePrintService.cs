using System.Globalization;
using System.Text;
using System.Text.Json;
using api.Src.Auth.Entities;
using api.Src.ConsultationSpace.ConduiteSection.Dtos.Responses;
using api.Src.ConsultationSpace.ConduiteSection.Entities;
using Microsoft.EntityFrameworkCore;

namespace api.Src.ConsultationSpace.ConduiteSection.Services;

public partial class ConduitePrintService(AppDbContext db) : IConduitePrintService
{
    private static readonly string BrandName = (
        Environment.GetEnvironmentVariable("brandname")
        ?? Environment.GetEnvironmentVariable("brand_name")
        ?? "Dermatologo"
    ).Trim();

    public async Task<PrintableConduiteDocumentResponse> GeneratePrintableDocument(
        Guid consultationId,
        string documentType,
        Guid cabinetIdentityId,
        IReadOnlyCollection<string>? sections = null,
        string? language = null)
    {
        var normalizedDocumentType = ConduiteActionKeys.NormalizeDocumentType(documentType);
        if (!ConduiteActionKeys.AllowedDocumentTypes.Contains(normalizedDocumentType))
        {
            throw new InvalidOperationException("Unsupported printable document type.");
        }

        var context = await LoadPrintContext(consultationId, cabinetIdentityId);
        var locale = ResolvePrintLocale(language, context.DoctorLanguagePreference);
        var documentTitle = GetDocumentTitle(normalizedDocumentType, locale);

        string htmlContent;
        if (string.Equals(normalizedDocumentType, ConduiteActionKeys.Ordonnance, StringComparison.OrdinalIgnoreCase))
        {
            htmlContent = BuildOrdonnancePrintableHtml(context, locale, documentTitle);
        }
        else if (string.Equals(normalizedDocumentType, ConduiteActionKeys.Certificat, StringComparison.OrdinalIgnoreCase))
        {
            htmlContent = BuildCertificatPrintableHtml(context, locale, documentTitle);
        }
        else if (string.Equals(normalizedDocumentType, "paraclinique", StringComparison.OrdinalIgnoreCase))
        {
            htmlContent = BuildParacliniquePrintableHtml(context, locale, sections);
        }
        else
        {
            var bodyHtml = normalizedDocumentType switch
            {
                "lettre_confrere" => BuildLettreConfrereBody(context, locale),
                _ => throw new InvalidOperationException("Unsupported printable document type."),
            };

            htmlContent = BuildPrintableHtml(context, documentTitle, bodyHtml, locale);
        }

        return new PrintableConduiteDocumentResponse
        {
            ConsultationId = consultationId,
            DocumentType = normalizedDocumentType,
            FileName = BuildFileName(normalizedDocumentType, context),
            HtmlContent = htmlContent,
        };
    }

    private async Task<PrintContext> LoadPrintContext(Guid consultationId, Guid cabinetIdentityId)
    {
        var consultation = await db.Consultations
            .AsNoTracking()
            .Include(c => c.Patient)
            .Include(c => c.CabinetIdentity)
                .ThenInclude(ci => ci.Doctor)
                    .ThenInclude(d => d!.Personalization)
            .Include(c => c.CabinetIdentity)
                .ThenInclude(ci => ci.Doctor)
                    .ThenInclude(d => d!.Clinics)
            .FirstOrDefaultAsync(c => c.Id == consultationId && c.CabinetIdentityId == cabinetIdentityId)
            ?? throw new InvalidOperationException("Consultation not found.");

        var doctor = consultation.CabinetIdentity.Doctor
            ?? throw new InvalidOperationException("Doctor profile not found for this consultation.");

        var actions = await db.ConsultationConduiteActions
            .AsNoTracking()
            .Where(action => action.ConsultationId == consultationId)
            .OrderBy(action => action.SortOrder)
            .ToListAsync();

        var actionsByKey = actions.ToDictionary(action => action.ActionKey, StringComparer.OrdinalIgnoreCase);

        return new PrintContext
        {
            ConsultationId = consultation.Id,
            ConsultationDate = consultation.ConsultationDate,
            PatientFirstName = consultation.Patient.Firstname,
            PatientLastName = consultation.Patient.Lastname,
            PatientSex = consultation.Patient.Sex,
            PatientDateOfBirth = consultation.Patient.DateOfBirth,
            PatientDossierNumber = consultation.Patient.DossierNumber,
            CabinetAddress = consultation.CabinetIdentity.Address,
            CabinetCity = consultation.CabinetIdentity.City,
            CabinetCountry = consultation.CabinetIdentity.Country,
            CabinetEmail = consultation.CabinetIdentity.Email,
            CabinetCodeCnam = consultation.CabinetIdentity.CodeCnam,
            DoctorFirstName = doctor.Firstname,
            DoctorLastName = doctor.Lastname,
            DoctorFirstNameArabic = doctor.FirstnameAr,
            DoctorLastNameArabic = doctor.LastnameAr,
            DoctorLandline = doctor.Landline,
            DoctorPhoneNumber = doctor.PhoneNumber,
            DoctorLanguagePreference = doctor.LanguagePreference,
            DoctorClinics = doctor.Clinics
                .Select(clinic => new PrintClinicInfo
                {
                    Name = clinic.Name,
                    Address = clinic.Address,
                    PhoneNumber = clinic.PhoneNumber,
                    GoogleMapsLink = clinic.GoogleMapsLink,
                })
                .ToList(),
            Personalization = BuildPersonalization(doctor.Personalization),
            ActionsByKey = actionsByKey,
        };
    }

    private static PrintPersonalization BuildPersonalization(DoctorPersonalization? personalization)
    {
        return new PrintPersonalization
        {
            ShowHeader = personalization?.ShowHeader ?? true,
            ShowFirstName = personalization?.ShowFirstName ?? true,
            ShowLastName = personalization?.ShowLastName ?? true,
            ShowCodeCnam = personalization?.ShowCodeCnam ?? true,
            ShowFirstNameArabic = personalization?.ShowFirstNameArabic ?? false,
            ShowLastNameArabic = personalization?.ShowLastNameArabic ?? false,
            ShowFooter = personalization?.ShowFooter ?? true,
            ShowFooterCabinetAddress = personalization?.ShowFooterCabinetAddress ?? true,
            ShowFooterLandline = personalization?.ShowFooterLandline ?? true,
            ShowFooterMobile = personalization?.ShowFooterMobile ?? true,
            ShowFooterEmail = personalization?.ShowFooterEmail ?? true,
        };
    }

        private static string BuildPrintableHtml(
                PrintContext context,
                string title,
                string bodyHtml,
                PrintLocale locale)
    {
                var headerHtml = BuildHeaderHtml(context, locale);
                var footerHtml = BuildFooterHtml(context, locale);
                var patientLabel = EscapeHtml($"{locale.PatientLabel}: {context.PatientLastName} {context.PatientFirstName}");
        var patientAge = CalculateAge(context.PatientDateOfBirth);
                var consultationDateLabel = EscapeHtml(FormatDate(context.ConsultationDate, locale, includeTime: false));

        return $$"""
<!doctype html>
<html lang="{{locale.LanguageCode}}" dir="{{locale.Direction}}">
<head>
  <meta charset="utf-8" />
  <title>{{EscapeHtml(title)}}</title>
  <style>
        @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #1f2937; background: #f7f7f7; }
        .print-toolbar { position: fixed; top: 12px; inset-inline-end: 12px; z-index: 9999; }
        .print-toolbar-btn {
            border: 1px solid #0f766e;
            background: #0f766e;
            color: #ffffff;
            border-radius: 999px;
            padding: 8px 14px;
            font-size: 13px;
            font-weight: 700;
            cursor: pointer;
        }
        .print-toolbar-btn:hover { background: #0c5f59; border-color: #0c5f59; }
    .print-page { width: 210mm; min-height: 297mm; margin: 0 auto; background: white; padding: 18mm 16mm 16mm; }
    .doc-header { border-bottom: 1px solid #d1d5db; margin-bottom: 10px; padding-bottom: 8px; }
    .doc-title { margin: 0 0 10px; font-size: 20px; color: #0f766e; }
    .doc-meta { margin: 0 0 12px; font-size: 13px; color: #374151; }
    .doc-meta p { margin: 2px 0; }
    .body-block { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; margin-bottom: 12px; }
    .body-block h3 { margin: 0 0 8px; font-size: 15px; color: #111827; }
    .label { font-weight: 700; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #e5e7eb; padding: 6px 8px; text-align: left; font-size: 13px; }
    th { background: #f9fafb; }
    pre { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px; white-space: pre-wrap; word-break: break-word; }
    .doc-footer { margin-top: 16px; border-top: 1px solid #d1d5db; padding-top: 8px; font-size: 12px; color: #4b5563; }
        .footer-contact-line { display: inline-flex; align-items: center; flex-wrap: wrap; justify-content: center; gap: 10px; }
        .footer-contact-item { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
        .footer-contact-item .fas { font-style: normal; font-weight: 700; color: #c89568; width: 1.2em; text-align: center; }
        .footer-contact-item .fa-phone-alt::before { content: "☎"; }
        .footer-contact-item .fa-mobile-alt::before { content: "📱"; }
        @media print {
            body { background: #ffffff; }
            .print-page { margin: 0; width: auto; min-height: auto; }
            .no-print { display: none !important; }
        }
  </style>
</head>
<body>
    <div class="print-toolbar no-print">
        <button type="button" class="print-toolbar-btn" onclick="window.__retryPrint && window.__retryPrint()">{{EscapeHtml(locale.PrintButtonLabel)}}</button>
    </div>
  <div class="print-page">
    {{headerHtml}}
    <h1 class="doc-title">{{EscapeHtml(title)}}</h1>
    <div class="doc-meta">
      <p>{{patientLabel}}</p>
            <p>{{locale.RecordLabel}}: {{context.PatientDossierNumber}} | {{locale.AgeLabel}}: {{patientAge}} | {{locale.ConsultationDateLabel}}: {{consultationDateLabel}}</p>
    </div>
    {{bodyHtml}}
    {{footerHtml}}
  </div>
    <script>
        (function () {
            var hasAutoPrinted = false;

            function doPrint() {
                try {
                    window.focus();
                    window.print();
                } catch {
                    // Ignore browser-level print errors and allow manual retry.
                }
            }

            function autoPrintOnce() {
                if (hasAutoPrinted) {
                    return;
                }

                hasAutoPrinted = true;
                doPrint();
            }

            window.__retryPrint = doPrint;
            window.addEventListener('load', function () {
                setTimeout(autoPrintOnce, 180);
            });
        })();
    </script>
</body>
</html>
""";
    }

        private static string BuildHeaderHtml(PrintContext context, PrintLocale locale)
    {
        if (!context.Personalization.ShowHeader)
        {
            return string.Empty;
        }

        var doctorNameParts = new List<string>();
        if (context.Personalization.ShowFirstName && !string.IsNullOrWhiteSpace(context.DoctorFirstName))
        {
            doctorNameParts.Add(context.DoctorFirstName);
        }

        if (context.Personalization.ShowLastName && !string.IsNullOrWhiteSpace(context.DoctorLastName))
        {
            doctorNameParts.Add(context.DoctorLastName);
        }

        var doctorName = doctorNameParts.Count > 0
            ? string.Join(" ", doctorNameParts)
            : locale.DoctorFallbackLabel;

        var arabicNameParts = new List<string>();
        if (context.Personalization.ShowFirstNameArabic && !string.IsNullOrWhiteSpace(context.DoctorFirstNameArabic))
        {
            arabicNameParts.Add(context.DoctorFirstNameArabic);
        }

        if (context.Personalization.ShowLastNameArabic && !string.IsNullOrWhiteSpace(context.DoctorLastNameArabic))
        {
            arabicNameParts.Add(context.DoctorLastNameArabic);
        }

        var sb = new StringBuilder();
        sb.Append("<header class=\"doc-header\">");
        sb.Append($"<div><strong>{EscapeHtml(locale.DoctorPrefix)} {EscapeHtml(doctorName)}</strong></div>");

        if (context.Personalization.ShowCodeCnam && !string.IsNullOrWhiteSpace(context.CabinetCodeCnam))
        {
            sb.Append($"<div>{EscapeHtml(locale.CnamLabel)}: {EscapeHtml(context.CabinetCodeCnam)}</div>");
        }

        if (arabicNameParts.Count > 0)
        {
            sb.Append($"<div dir=\"rtl\">{EscapeHtml(string.Join(" ", arabicNameParts))}</div>");
        }

        sb.Append("</header>");
        return sb.ToString();
    }

    private static string BuildFooterHtml(PrintContext context, PrintLocale locale)
    {
        if (!context.Personalization.ShowFooter)
        {
            return string.Empty;
        }

        var lines = new List<string>();

        if (context.Personalization.ShowFooterCabinetAddress)
        {
            var addressSegments = new[]
            {
                context.CabinetAddress,
                context.CabinetCity,
                context.CabinetCountry,
            }
            .Where(segment => !string.IsNullOrWhiteSpace(segment))
            .ToList();

            if (addressSegments.Count > 0)
            {
                lines.Add($"{EscapeHtml(locale.AddressLabel)}: {EscapeHtml(string.Join(", ", addressSegments))}");
            }
        }

        var contactParts = new List<string>();

        if (context.Personalization.ShowFooterLandline && !string.IsNullOrWhiteSpace(context.DoctorLandline))
        {
            contactParts.Add(BuildFooterContactIconHtml("fas fa-phone-alt", context.DoctorLandline));
        }

        if (context.Personalization.ShowFooterMobile && !string.IsNullOrWhiteSpace(context.DoctorPhoneNumber))
        {
            contactParts.Add(BuildFooterContactIconHtml("fas fa-mobile-alt", context.DoctorPhoneNumber));
        }

        if (context.Personalization.ShowFooterEmail && !string.IsNullOrWhiteSpace(context.CabinetEmail))
        {
            contactParts.Add($"{EscapeHtml(locale.EmailLabel)}: {EscapeHtml(context.CabinetEmail)}");
        }

        if (contactParts.Count > 0)
        {
            lines.Add($"<span class=\"footer-contact-line\">{string.Join("", contactParts)}</span>");
        }

        if (lines.Count == 0)
        {
            return string.Empty;
        }

        var sb = new StringBuilder();
        sb.Append("<footer class=\"doc-footer\">");

        foreach (var line in lines)
        {
            sb.Append($"<div>{line}</div>");
        }

        sb.Append("</footer>");
        return sb.ToString();
    }

        private static string BuildOrdonnancePrintableHtml(
                PrintContext context,
                PrintLocale locale,
                string title)
        {
                var headerHtml = BuildOrdonnanceHeaderHtml(context, locale);
                var footerHtml = BuildOrdonnanceFooterHtml(context, locale);
                var bodyHtml = BuildOrdonnanceMainContent(context, locale);

                return $$"""
<!doctype html>
<html lang="{{locale.LanguageCode}}" dir="{{locale.Direction}}">
<head>
    <meta charset="utf-8" />
    <title>{{EscapeHtml(title)}}</title>
    <style>
        @page { size: A4; margin: 0; }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            color: #111827;
            background: #f7f7f7;
            font-family: "Segoe UI", Tahoma, Arial, "Noto Naskh Arabic", sans-serif;
            line-height: 1.5;
        }
        .print-toolbar {
            position: fixed;
            top: 12px;
            inset-inline-end: 12px;
            z-index: 9999;
        }
        .print-toolbar-btn {
            border: 1px solid #175042;
            background: #175042;
            color: #ffffff;
            border-radius: 999px;
            padding: 8px 14px;
            font-size: 13px;
            font-weight: 700;
            cursor: pointer;
        }
        .print-toolbar-btn:hover {
            background: #123a31;
            border-color: #123a31;
        }
        .page {
            width: 210mm;
            min-height: 297mm;
            margin: 0 auto;
            padding: 12mm 14mm 10mm;
            background: #ffffff;
        }
        .sheet {
            min-height: calc(297mm - 22mm);
            display: flex;
            flex-direction: column;
        }
        .inaya-header {
            margin-bottom: 8mm;
        }
        .header-grid {
            display: grid;
            grid-template-columns: 1fr auto 1fr;
            gap: 10mm;
            align-items: start;
        }
        .header-col-center {
            text-align: center;
            white-space: nowrap;
            padding-top: 2mm;
            font-size: 13px;
        }
        .doctor-main,
        .doctor-main-ar {
            font-size: 15px;
            font-weight: 700;
            line-height: 1.5;
            min-height: 24px;
        }
        .doctor-main-ar {
            text-align: right;
            direction: rtl;
        }
        .accent-line {
            border-top: 2px solid #c89568;
            margin-top: 4px;
        }
        .ordonnance-title {
            margin: 0 0 12px;
            text-align: center;
            color: #175042;
            letter-spacing: 0.6px;
            font-size: 24px;
            font-weight: 700;
            text-transform: uppercase;
        }
        .ord-date,
        .ord-patient {
            margin: 0 0 7px;
            font-size: 14px;
            font-weight: 600;
        }
        .ord-drug-grid {
            margin-top: 16px;
            display: grid;
            grid-template-columns: 1fr;
            gap: 12px;
        }
        .ord-drug-grid.two-columns {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            column-gap: 24px;
        }
        .ord-drug-item {
            margin-bottom: 10px;
            break-inside: avoid;
        }
        .ord-drug-name {
            margin: 0 0 2px;
            font-size: 14px;
            font-weight: 700;
        }
        .ord-drug-details {
            margin: 0;
            font-size: 14px;
            line-height: 1.5;
        }
        .ord-extra {
            margin-top: 8px;
            font-size: 14px;
            line-height: 1.5;
        }
        .ord-extra-label {
            font-weight: 700;
            color: #c89568;
        }
        .ord-empty {
            margin-top: 16px;
            font-size: 14px;
            color: #374151;
        }
        .inaya-footer {
            margin-top: auto;
            padding-top: 8px;
            font-size: 12.5px;
            text-align: center;
            color: #374151;
        }
        .inaya-footer .accent-line {
            width: min(92%, 760px);
            margin: 0 auto 8px;
        }
        .inaya-footer-line {
            margin: 2px 0;
            line-height: 1.5;
        }
        .footer-contact-line {
            display: inline-flex;
            align-items: center;
            flex-wrap: wrap;
            justify-content: center;
            gap: 10px;
        }
        .footer-contact-item {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            white-space: nowrap;
        }
        .footer-contact-item .fas {
            font-style: normal;
            font-weight: 700;
            color: #c89568;
            width: 1.2em;
            text-align: center;
        }
        .footer-contact-item .fa-phone-alt::before { content: "☎"; }
        .footer-contact-item .fa-mobile-alt::before { content: "📱"; }

        @media print {
            body { background: #ffffff; }
            .page {
                margin: 0;
                width: auto;
                min-height: auto;
                padding: 10mm 12mm 8mm;
            }
            .sheet { min-height: auto; }
            .ord-drug-item { page-break-inside: avoid; }
            .no-print { display: none !important; }
        }
    </style>
</head>
<body>
    <div class="print-toolbar no-print">
        <button type="button" class="print-toolbar-btn" onclick="window.__retryPrint && window.__retryPrint()">{{EscapeHtml(locale.PrintButtonLabel)}}</button>
    </div>
    <div class="page">
        <div class="sheet">
            {{headerHtml}}
            {{bodyHtml}}
            {{footerHtml}}
        </div>
    </div>
    <script>
        (function () {
            var hasAutoPrinted = false;

            function doPrint() {
                try {
                    window.focus();
                    window.print();
                } catch {
                    // Ignore browser-level print errors and allow manual retry.
                }
            }

            function autoPrintOnce() {
                if (hasAutoPrinted) {
                    return;
                }

                hasAutoPrinted = true;
                doPrint();
            }

            window.__retryPrint = doPrint;
            window.addEventListener('load', function () {
                setTimeout(autoPrintOnce, 180);
            });
        })();
    </script>
</body>
</html>
""";
        }

        private static string BuildCertificatPrintableHtml(
                PrintContext context,
                PrintLocale locale,
                string title)
        {
                var headerHtml = BuildOrdonnanceHeaderHtml(context, locale);
                var footerHtml = BuildOrdonnanceFooterHtml(context, locale);
                var bodyHtml = BuildCertificatBody(context, locale);

                return $$"""
<!doctype html>
<html lang="{{locale.LanguageCode}}" dir="{{locale.Direction}}">
<head>
    <meta charset="utf-8" />
    <title>{{EscapeHtml(title)}}</title>
    <style>
        @page { size: A4; margin: 0; }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            color: #111827;
            background: #f7f7f7;
            font-family: "Times New Roman", Georgia, serif;
            line-height: 1.5;
        }
        .print-toolbar {
            position: fixed;
            top: 12px;
            inset-inline-end: 12px;
            z-index: 9999;
        }
        .print-toolbar-btn {
            border: 1px solid #175042;
            background: #175042;
            color: #ffffff;
            border-radius: 999px;
            padding: 8px 14px;
            font-size: 13px;
            font-weight: 700;
            cursor: pointer;
        }
        .print-toolbar-btn:hover {
            background: #123a31;
            border-color: #123a31;
        }
        .page {
            width: 210mm;
            min-height: 297mm;
            margin: 0 auto;
            padding: 12mm 14mm 10mm;
            background: #ffffff;
        }
        .sheet {
            min-height: calc(297mm - 22mm);
            display: flex;
            flex-direction: column;
        }
        .certificat-main {
            margin-top: 4mm;
        }
        .certificat-card {
            min-height: 150mm;
            padding: 4mm 3mm;
        }
        .certificat-title {
            margin: 0;
            text-align: center;
            color: #175042;
            font-size: 30px;
            font-weight: 700;
            line-height: 1.2;
        }
        .certificat-date {
            margin-top: 26px;
            margin-bottom: 26px;
            text-align: right;
            font-size: 19px;
            font-weight: 600;
        }
        .certificat-paragraph {
            margin: 16px 0;
            font-size: 20px;
            line-height: 1.5;
            font-weight: 600;
        }
        .certificat-paragraph strong {
            font-weight: 700;
        }
        .certificat-signoff {
            margin-top: 28px;
            text-align: right;
            font-size: 20px;
            font-weight: 600;
        }
        .certificat-empty {
            margin-top: 12mm;
            font-size: 16px;
            text-align: center;
            color: #374151;
        }

        @media print {
            body { background: #ffffff; }
            .page {
                margin: 0;
                width: auto;
                min-height: auto;
                padding: 10mm 12mm 8mm;
            }
            .sheet { min-height: auto; }
            .no-print { display: none !important; }
        }
    </style>
</head>
<body>
    <div class="print-toolbar no-print">
        <button type="button" class="print-toolbar-btn" onclick="window.__retryPrint && window.__retryPrint()">{{EscapeHtml(locale.PrintButtonLabel)}}</button>
    </div>
    <div class="page">
        <div class="sheet">
            {{headerHtml}}
            {{bodyHtml}}
            {{footerHtml}}
        </div>
    </div>
    <script>
        (function () {
            var hasAutoPrinted = false;

            function doPrint() {
                try {
                    window.focus();
                    window.print();
                } catch {
                    // Ignore browser-level print errors and allow manual retry.
                }
            }

            function autoPrintOnce() {
                if (hasAutoPrinted) {
                    return;
                }

                hasAutoPrinted = true;
                doPrint();
            }

            window.__retryPrint = doPrint;
            window.addEventListener('load', function () {
                setTimeout(autoPrintOnce, 180);
            });
        })();
    </script>
</body>
</html>
""";
        }

        private static string BuildOrdonnanceHeaderHtml(PrintContext context, PrintLocale locale)
        {
                if (!context.Personalization.ShowHeader)
                {
                        return string.Empty;
                }
            var doctorName = BuildPersonalizedDoctorLatinName(context, locale);
            var doctorArabicName = BuildPersonalizedDoctorArabicName(context, locale);
            var cnamValue = BuildPersonalizedCnamValue(context);

                var sb = new StringBuilder();
                sb.Append("<header class=\"inaya-header\">");
                sb.Append("<div class=\"header-grid\">");

                sb.Append("<div>");
                sb.Append($"<div class=\"doctor-main\">{EscapeHtml(doctorName)}</div>");
                sb.Append("<div class=\"accent-line\"></div>");
                sb.Append("</div>");

                sb.Append("<div class=\"header-col-center\">");
                if (context.Personalization.ShowCodeCnam)
                {
            sb.Append($"<strong>{EscapeHtml(locale.CnamLabel)}: {EscapeHtml(cnamValue)}</strong>");
                }
                sb.Append("</div>");

                sb.Append("<div>");
        if (!string.IsNullOrWhiteSpace(doctorArabicName))
                {
            sb.Append($"<div class=\"doctor-main-ar\">{EscapeHtml(doctorArabicName)}</div>");
                        sb.Append("<div class=\"accent-line\"></div>");
                }
                else
                {
                        sb.Append("<div class=\"doctor-main-ar\"></div>");
                }
                sb.Append("</div>");

                sb.Append("</div>");
                sb.Append("</header>");
                return sb.ToString();
        }

        private static string BuildOrdonnanceFooterHtml(PrintContext context, PrintLocale locale)
        {
                if (!context.Personalization.ShowFooter)
                {
                        return string.Empty;
                }

                var lines = new List<string>();

            var addressLine = BuildPersonalizedFooterAddressLine(context);
            if (!string.IsNullOrWhiteSpace(addressLine))
            {
                lines.Add(EscapeHtml(addressLine));
            }

                var contactParts = BuildPersonalizedFooterContacts(context)
                .Select(contact => contact.Kind switch
                {
                PrintFooterContactKind.Landline => BuildFooterContactIconHtml("fas fa-phone-alt", contact.Value),
                PrintFooterContactKind.Mobile => BuildFooterContactIconHtml("fas fa-mobile-alt", contact.Value),
                PrintFooterContactKind.Email => $"{EscapeHtml(locale.EmailLabel)}: {EscapeHtml(contact.Value)}",
                _ => string.Empty,
                })
                .Where(part => !string.IsNullOrWhiteSpace(part))
                .ToList();

                if (contactParts.Count > 0)
                {
                    lines.Add($"<span class=\"footer-contact-line\">{string.Join("", contactParts)}</span>");
                }

                if (lines.Count == 0)
                {
                        return string.Empty;
                }

                var sb = new StringBuilder();
                sb.Append("<footer class=\"inaya-footer\">");
                sb.Append("<div class=\"accent-line\"></div>");
                foreach (var line in lines)
                {
                        sb.Append($"<div class=\"inaya-footer-line\">{line}</div>");
                }
                sb.Append("</footer>");
                return sb.ToString();
        }

            private static string BuildFooterContactIconHtml(string iconClass, string value)
            {
                return $"<span class=\"footer-contact-item\"><i class=\"{iconClass}\" aria-hidden=\"true\"></i>{EscapeHtml(value)}</span>";
            }

    private static string BuildPersonalizedDoctorLatinName(PrintContext context, PrintLocale locale)
    {
        var doctorNameParts = new List<string>();
        if (context.Personalization.ShowFirstName && !string.IsNullOrWhiteSpace(context.DoctorFirstName))
        {
            doctorNameParts.Add(context.DoctorFirstName);
        }

        if (context.Personalization.ShowLastName && !string.IsNullOrWhiteSpace(context.DoctorLastName))
        {
            doctorNameParts.Add(context.DoctorLastName);
        }

        var doctorName = doctorNameParts.Count == 0
            ? locale.DoctorFallbackLabel
            : string.Join(" ", doctorNameParts);

        return $"{locale.DoctorPrefix} {doctorName}".Trim();
    }

    private static string BuildPersonalizedDoctorArabicName(PrintContext context, PrintLocale locale)
    {
        var firstNameArabic = context.DoctorFirstNameArabic;
        var lastNameArabic = context.DoctorLastNameArabic;

        if (string.IsNullOrWhiteSpace(firstNameArabic) && context.Personalization.ShowFirstNameArabic)
        {
            firstNameArabic = context.DoctorFirstName;
        }

        if (string.IsNullOrWhiteSpace(lastNameArabic) && context.Personalization.ShowLastNameArabic)
        {
            lastNameArabic = context.DoctorLastName;
        }

        var doctorArabicParts = new List<string>();
        if (context.Personalization.ShowLastNameArabic && !string.IsNullOrWhiteSpace(lastNameArabic))
        {
            doctorArabicParts.Add(lastNameArabic);
        }

        if (context.Personalization.ShowFirstNameArabic && !string.IsNullOrWhiteSpace(firstNameArabic))
        {
            doctorArabicParts.Add(firstNameArabic);
        }

        if (doctorArabicParts.Count == 0)
        {
            return string.Empty;
        }

        return $"{locale.DoctorPrefixArabic} {string.Join(" ", doctorArabicParts)}".Trim();
    }

    private static string BuildPersonalizedCnamValue(PrintContext context)
    {
        return string.IsNullOrWhiteSpace(context.CabinetCodeCnam)
            ? ".............................."
            : context.CabinetCodeCnam;
    }

    private static string BuildPersonalizedFooterAddressLine(PrintContext context)
    {
        if (!context.Personalization.ShowFooterCabinetAddress)
        {
            return string.Empty;
        }

        var addressSegments = new[]
        {
            context.CabinetAddress,
            context.CabinetCity,
            context.CabinetCountry,
        }
        .Where(segment => !string.IsNullOrWhiteSpace(segment))
        .ToList();

        return addressSegments.Count == 0
            ? string.Empty
            : string.Join(" ", addressSegments);
    }

    private static List<PrintFooterContactItem> BuildPersonalizedFooterContacts(PrintContext context)
    {
        var contacts = new List<PrintFooterContactItem>();

        if (context.Personalization.ShowFooterLandline && !string.IsNullOrWhiteSpace(context.DoctorLandline))
        {
            contacts.Add(new PrintFooterContactItem
            {
                Kind = PrintFooterContactKind.Landline,
                Value = context.DoctorLandline,
            });
        }

        if (context.Personalization.ShowFooterMobile && !string.IsNullOrWhiteSpace(context.DoctorPhoneNumber))
        {
            contacts.Add(new PrintFooterContactItem
            {
                Kind = PrintFooterContactKind.Mobile,
                Value = context.DoctorPhoneNumber,
            });
        }

        if (context.Personalization.ShowFooterEmail && !string.IsNullOrWhiteSpace(context.CabinetEmail))
        {
            contacts.Add(new PrintFooterContactItem
            {
                Kind = PrintFooterContactKind.Email,
                Value = context.CabinetEmail,
            });
        }

        return contacts;
    }

        private static string BuildOrdonnanceMainContent(PrintContext context, PrintLocale locale)
        {
                var sb = new StringBuilder();
                sb.Append("<main>");
                sb.Append($"<h1 class=\"ordonnance-title\">{EscapeHtml(locale.OrdonnanceTitle)}</h1>");

                if (!context.ActionsByKey.TryGetValue(ConduiteActionKeys.Ordonnance, out var action))
                {
                        sb.Append($"<p class=\"ord-empty\">{EscapeHtml(locale.NoOrdonnanceRecordedMessage)}</p>");
                        sb.Append("</main>");
                        return sb.ToString();
                }

                sb.Append($"<p class=\"ord-date\">{EscapeHtml(FormatDate(context.ConsultationDate, locale, includeTime: false))}</p>");
                sb.Append($"<p class=\"ord-patient\">{EscapeHtml(locale.PatientSalutationLabel)} {EscapeHtml(context.PatientLastName)} {EscapeHtml(context.PatientFirstName)}</p>");

                var drugs = ReadArray(action.Payload, "listDrugs")
                        .Select(drug => new OrdonnanceDrugLine
                        {
                        Name = TranslateKnownOrdonnanceValue(ReadString(drug, "nom"), locale),
                        Posology = TranslateKnownOrdonnanceValue(ReadString(drug, "posology"), locale),
                                Eye = ReadString(drug, "oeil"),
                        Duration = TranslateKnownOrdonnanceValue(ReadString(drug, "duree"), locale),
                        })
                        .Where(drug =>
                                !string.IsNullOrWhiteSpace(drug.Name) ||
                                !string.IsNullOrWhiteSpace(drug.Posology) ||
                                !string.IsNullOrWhiteSpace(drug.Eye) ||
                                !string.IsNullOrWhiteSpace(drug.Duration))
                        .ToList();

                if (drugs.Count == 0)
                {
                        sb.Append($"<p class=\"ord-empty\">{EscapeHtml(locale.NoMedicationRecordedMessage)}</p>");
                }
                else
                {
                        var twoColumns = drugs.Count > 6;
                        sb.Append(twoColumns
                                ? "<div class=\"ord-drug-grid two-columns\">"
                                : "<div class=\"ord-drug-grid\">");

                        if (!twoColumns)
                        {
                                sb.Append(RenderOrdonnanceDrugColumn(drugs));
                        }
                        else
                        {
                                var pivot = (int)Math.Ceiling(drugs.Count / 2d);
                                sb.Append(RenderOrdonnanceDrugColumn(drugs.Take(pivot)));
                                sb.Append(RenderOrdonnanceDrugColumn(drugs.Skip(pivot)));
                        }

                        sb.Append("</div>");
                }

                var consigne = TranslateKnownOrdonnanceValue(ReadString(action.Payload, "consigne"), locale);
                var infoAdditionnelle = TranslateKnownOrdonnanceValue(ReadString(action.Payload, "informationAdditionnel"), locale);

                if (!string.IsNullOrWhiteSpace(consigne))
                {
                        sb.Append($"<p class=\"ord-extra\"><span class=\"ord-extra-label\">{EscapeHtml(locale.ConsigneLabel)}:</span> {Nl2Br(consigne)}</p>");
                }

                if (!string.IsNullOrWhiteSpace(infoAdditionnelle))
                {
                        sb.Append($"<p class=\"ord-extra\"><span class=\"ord-extra-label\">{EscapeHtml(locale.AdditionalInformationLabel)}:</span> {Nl2Br(infoAdditionnelle)}</p>");
                }

                sb.Append("</main>");
                return sb.ToString();
        }

        private static string RenderOrdonnanceDrugColumn(IEnumerable<OrdonnanceDrugLine> drugs)
        {
                var sb = new StringBuilder();
                sb.Append("<div>");

                foreach (var drug in drugs)
                {
                        var details = new[]
                        {
                                drug.Posology,
                                drug.Eye,
                                drug.Duration,
                        }
                        .Where(item => !string.IsNullOrWhiteSpace(item))
                        .Select(item => EscapeHtml(item.Trim()))
                        .ToList();

                        sb.Append("<div class=\"ord-drug-item\">");
                        sb.Append($"<p class=\"ord-drug-name\">{EscapeHtml(DefaultIfEmpty(drug.Name, "-"))}</p>");
                        sb.Append($"<p class=\"ord-drug-details\">{(details.Count == 0 ? "-" : string.Join(" , ", details))}</p>");
                        sb.Append("</div>");
                }

                sb.Append("</div>");
                return sb.ToString();
        }

    private static string BuildOrdonnanceBody(PrintContext context)
    {
        if (!context.ActionsByKey.TryGetValue(ConduiteActionKeys.Ordonnance, out var action))
        {
            return "<div class=\"body-block\"><h3>Ordonnance</h3><p>Aucune ordonnance enregistree.</p></div>";
        }

        var sb = new StringBuilder();
        sb.Append("<div class=\"body-block\"><h3>Ordonnance</h3>");

        var drugs = ReadArray(action.Payload, "listDrugs");
        if (drugs.Count == 0)
        {
            sb.Append("<p>Aucun medicament saisi.</p>");
        }
        else
        {
            sb.Append("<table><thead><tr><th>Medicament</th><th>Posologie</th><th>Duree</th><th>Oeil</th></tr></thead><tbody>");
            foreach (var drug in drugs)
            {
                var nom = ReadString(drug, "nom");
                var posology = ReadString(drug, "posology");
                var duree = ReadString(drug, "duree");
                var oeil = ReadString(drug, "oeil");

                sb.Append("<tr>");
                sb.Append($"<td>{EscapeHtml(DefaultIfEmpty(nom, "-"))}</td>");
                sb.Append($"<td>{EscapeHtml(DefaultIfEmpty(posology, "-"))}</td>");
                sb.Append($"<td>{EscapeHtml(DefaultIfEmpty(duree, "-"))}</td>");
                sb.Append($"<td>{EscapeHtml(DefaultIfEmpty(oeil, "-"))}</td>");
                sb.Append("</tr>");
            }

            sb.Append("</tbody></table>");
        }

        var consigne = ReadString(action.Payload, "consigne");
        var infoAdditionnelle = ReadString(action.Payload, "informationAdditionnel");

        if (!string.IsNullOrWhiteSpace(consigne))
        {
            sb.Append($"<p><span class=\"label\">Consigne:</span> {Nl2Br(consigne)}</p>");
        }

        if (!string.IsNullOrWhiteSpace(infoAdditionnelle))
        {
            sb.Append($"<p><span class=\"label\">Information additionnelle:</span> {Nl2Br(infoAdditionnelle)}</p>");
        }

        sb.Append("</div>");
        return sb.ToString();
    }

    private static string BuildCertificatBody(PrintContext context, PrintLocale locale)
    {
        if (!context.ActionsByKey.TryGetValue(ConduiteActionKeys.Certificat, out var action))
        {
            return $"<main class=\"certificat-main\"><p class=\"certificat-empty\">{EscapeHtml(GetNoCertificatRecordedMessage(locale))}</p></main>";
        }

        var certificatTypeKey = ResolveCertificatTypeKey(action.Payload);
        var bodyContent = certificatTypeKey switch
        {
            "presence" => BuildCertificatPresenceBody(context, action.Payload, locale),
            "accompaniment" => BuildCertificatAccompanimentBody(context, action.Payload, locale),
            "custom" => BuildCertificatCustomBody(context, action.Payload, locale),
            _ => BuildCertificatRestBody(context, action.Payload, locale),
        };

        return $"<main class=\"certificat-main\">{bodyContent}</main>";
    }

    private static string BuildCertificatRestBody(
        PrintContext context,
        Dictionary<string, JsonElement> payload,
        PrintLocale locale)
    {
        var patientName = BuildPatientDisplayName(context);
        var doctorDisplayName = BuildCertificatDoctorDisplayName(context, locale);
        var nombre = DefaultIfEmpty(ReadString(payload, "nombre"), "-");
        var compterDe = FormatPayloadDate(
            ReadString(payload, "compterDe"),
            locale,
            fallback: FormatDate(context.ConsultationDate, locale, includeTime: false));
        var issueDate = FormatPayloadDate(
            ReadString(payload, "dateCertificat"),
            locale,
            fallback: FormatDate(DateTime.Now, locale, includeTime: false));

        var restSentence = locale.LanguageCode switch
        {
            "ar" => $"السيد/السيدة {patientName} يحتاج(تحتاج) الى راحة لمدة {nombre} يوما بداية من {compterDe} الا في حالة حدوث مضاعفات.",
            "en" => $"Mr/Ms {patientName} requires work leave of {nombre} day(s) starting from {compterDe} unless complications occur.",
            _ => $"Mme/Mr {patientName} nécessite un arrêt de travail de {nombre} jours à dater du {compterDe} sauf complications.",
        };

        var sb = new StringBuilder();
        sb.Append("<section class=\"certificat-card\">");
        sb.Append($"<h2 class=\"certificat-title\">{EscapeHtml(GetCertificatTypeTitle("rest", locale))}</h2>");
        sb.Append($"<p class=\"certificat-date\">{EscapeHtml(BuildCertificatDateLine(issueDate, locale))}</p>");
        sb.Append($"<p class=\"certificat-paragraph\">{EscapeHtml(GetCertificatRestIntroPrefix(locale))} <strong>{EscapeHtml(doctorDisplayName)}</strong> {EscapeHtml(GetCertificatRestIntroSuffix(locale))}</p>");
        sb.Append($"<p class=\"certificat-paragraph\">{EscapeHtml(restSentence)}</p>");
        sb.Append($"<p class=\"certificat-signoff\">{EscapeHtml(GetCertificatSignoff(locale))}</p>");
        sb.Append("</section>");
        return sb.ToString();
    }

    private static string BuildCertificatPresenceBody(
        PrintContext context,
        Dictionary<string, JsonElement> payload,
        PrintLocale locale)
    {
        var patientName = BuildPatientDisplayName(context);
        var doctorDisplayName = BuildCertificatDoctorDisplayName(context, locale);
        var dateCertificat = FormatPayloadDate(
            ReadString(payload, "dateCertificat"),
            locale,
            fallback: FormatDate(DateTime.Now, locale, includeTime: false));

        var consultationSentence = locale.LanguageCode switch
        {
            "ar" => $"اشهد انا {doctorDisplayName} ان {patientName} تمت معاينته(ا) اليوم في الاستشارة.",
            "en" => $"I, {doctorDisplayName}, certify that {patientName} was seen today during consultation.",
            _ => $"Je soussigne {doctorDisplayName} certifie que {patientName} , a ete vu ce jour a la consultation.",
        };

        var sb = new StringBuilder();
        sb.Append("<section class=\"certificat-card\">");
        sb.Append($"<h2 class=\"certificat-title\">{EscapeHtml(GetCertificatTypeTitle("presence", locale))}</h2>");
        sb.Append($"<p class=\"certificat-date\">{EscapeHtml(BuildCertificatDateLine(dateCertificat, locale))}</p>");
        sb.Append($"<p class=\"certificat-paragraph\">{EscapeHtml(consultationSentence)}</p>");
        sb.Append($"<p class=\"certificat-paragraph\">{EscapeHtml(GetPresenceCertificateLegalSentence(locale))}</p>");
        sb.Append($"<p class=\"certificat-signoff\">{EscapeHtml(GetCertificatSignoff(locale))}</p>");
        sb.Append("</section>");
        return sb.ToString();
    }

    private static string BuildCertificatAccompanimentBody(
        PrintContext context,
        Dictionary<string, JsonElement> payload,
        PrintLocale locale)
    {
        var patientName = BuildPatientDisplayNameFirstLast(context);
        var patientCivility = ResolvePatientCivility(context.PatientSex, locale);
        var doctorDisplayName = BuildCertificatDoctorDisplayName(context, locale);
        var issueDate = FormatDate(DateTime.Now, locale, includeTime: false);
        var accompagnantCivilite = DefaultIfEmpty(
            ReadString(payload, "civiliteAccompagnant"),
            locale.LanguageCode switch
            {
                "ar" => "السيد/السيدة",
                "en" => "Mr/Ms",
                _ => "M./Mme",
            });
        var accompagnantNom = DefaultIfEmpty(ReadString(payload, "nomPrenomAccompagnant"), "-");
        var feminineSuffix = locale.LanguageCode == "fr" && IsFemaleSex(context.PatientSex)
            ? "e"
            : string.Empty;

        var introSentence = locale.LanguageCode switch
        {
            "ar" => $"انا الممضي(ة) اسفله {doctorDisplayName} اشهد ان {patientCivility} {patientName}",
            "en" => $"I, the undersigned {doctorDisplayName}, certify that {patientCivility} {patientName}",
            _ => $"Je soussigne(e) {doctorDisplayName} certifie que {patientCivility} {patientName}",
        };

        var accompanimentSentence = locale.LanguageCode switch
        {
            "ar" => "قد تمت مرافقته(ا) اثناء الاستشارة الطبية من طرف :",
            "en" => "was accompanied during the medical consultation by:",
            _ => $"a été accompagné{feminineSuffix}, lors de sa consultation médicale par :",
        };

        var sb = new StringBuilder();
        sb.Append("<section class=\"certificat-card\">");
        sb.Append($"<h2 class=\"certificat-title\">{EscapeHtml(GetCertificatTypeTitle("accompaniment", locale))}</h2>");
        sb.Append($"<p class=\"certificat-date\">{EscapeHtml(BuildCertificatDateLine(issueDate, locale))}</p>");
        sb.Append($"<p class=\"certificat-paragraph\">{EscapeHtml(introSentence)}</p>");
        sb.Append($"<p class=\"certificat-paragraph\">{EscapeHtml(accompanimentSentence)}</p>");
        sb.Append($"<p class=\"certificat-paragraph\"><strong>{EscapeHtml($"{accompagnantCivilite} {accompagnantNom}".Trim())}</strong></p>");
        sb.Append($"<p class=\"certificat-paragraph\">{EscapeHtml(GetCertificateLegalSentence(locale))}</p>");
        sb.Append($"<p class=\"certificat-signoff\">{EscapeHtml(GetCertificatSignoff(locale))}</p>");
        sb.Append("</section>");
        return sb.ToString();
    }

    private static string BuildCertificatCustomBody(
        PrintContext context,
        Dictionary<string, JsonElement> payload,
        PrintLocale locale)
    {
        var patientName = BuildPatientDisplayName(context);
        var doctorDisplayName = BuildCertificatDoctorDisplayName(context, locale);
        var customTypeLabel = ResolveCertificatTypeLabel(payload, locale);
        var dateCertificat = FormatPayloadDate(
            ReadString(payload, "dateCertificat"),
            locale,
            fallback: FormatDate(DateTime.Now, locale, includeTime: false));
        var description = DefaultIfEmpty(ReadString(payload, "description"), "-");

        var defaultSentence = locale.LanguageCode switch
        {
            "ar" => $"اشهد انا {doctorDisplayName} ان {patientName}.",
            "en" => $"I, {doctorDisplayName}, certify that {patientName}.",
            _ => $"Je soussigne {doctorDisplayName} certifie que {patientName}",
        };

        var sb = new StringBuilder();
        sb.Append("<section class=\"certificat-card\">");
        sb.Append($"<h2 class=\"certificat-title\">{EscapeHtml(BuildCustomCertificatTitle(customTypeLabel, locale))}</h2>");
        sb.Append($"<p class=\"certificat-date\">{EscapeHtml(BuildCertificatDateLine(dateCertificat, locale))}</p>");
        sb.Append($"<p class=\"certificat-paragraph\">{EscapeHtml(defaultSentence)}</p>");
        sb.Append($"<p class=\"certificat-paragraph\">{Nl2Br(description)}</p>");
        sb.Append($"<p class=\"certificat-signoff\">{EscapeHtml(GetCertificatSignoff(locale))}</p>");
        sb.Append("</section>");
        return sb.ToString();
    }

    private static string ResolveCertificatTypeKey(Dictionary<string, JsonElement> payload)
    {
        var rawType = ReadString(payload, "types");
        if (string.IsNullOrWhiteSpace(rawType))
        {
            rawType = ReadString(payload, "type");
        }

        if (string.IsNullOrWhiteSpace(rawType))
        {
            rawType = ReadString(payload, "certificateType");
        }

        if (string.IsNullOrWhiteSpace(rawType))
        {
            return "rest";
        }

        var normalizedType = NormalizeGenericToken(rawType);

        if (normalizedType.Contains("accompagnement", StringComparison.Ordinal) ||
            normalizedType.Contains("accompaniment", StringComparison.Ordinal) ||
            normalizedType.Contains("companion", StringComparison.Ordinal))
        {
            return "accompaniment";
        }

        if (normalizedType.Contains("presence", StringComparison.Ordinal) ||
            normalizedType.Contains("attendance", StringComparison.Ordinal))
        {
            return "presence";
        }

        if (normalizedType.Contains("repos", StringComparison.Ordinal) ||
            normalizedType.Contains("rest", StringComparison.Ordinal) ||
            normalizedType.Contains("arrettravail", StringComparison.Ordinal))
        {
            return "rest";
        }

        return "custom";
    }

    private static string ResolveCertificatTypeLabel(
        Dictionary<string, JsonElement> payload,
        PrintLocale locale)
    {
        var rawType = ReadString(payload, "types");
        if (string.IsNullOrWhiteSpace(rawType))
        {
            rawType = ReadString(payload, "type");
        }

        if (string.IsNullOrWhiteSpace(rawType))
        {
            rawType = ReadString(payload, "certificateType");
        }

        return string.IsNullOrWhiteSpace(rawType)
            ? locale.CertificatTitle
            : rawType.Trim();
    }

    private static string BuildCertificatDateLine(string dateLabel, PrintLocale locale)
    {
        return locale.LanguageCode switch
        {
            "ar" => $"تونس في {dateLabel}",
            _ => $"Tunis le {dateLabel}",
        };
    }

    private static string GetCertificatRestIntroPrefix(PrintLocale locale)
    {
        return locale.LanguageCode switch
        {
            "ar" => "انا الممضي(ة) اسفله",
            "en" => "I, the undersigned",
            _ => "Je soussigne",
        };
    }

    private static string GetCertificatRestIntroSuffix(PrintLocale locale)
    {
        return locale.LanguageCode switch
        {
            "ar" => "اشهد ان الحالة الصحية لـ :",
            "en" => "certify that the health condition of:",
            _ => "certifie que l'état de santé de :",
        };
    }

    private static string BuildCustomCertificatTitle(string customType, PrintLocale locale)
    {
        return locale.LanguageCode switch
        {
            "ar" => $"شهادة {customType}",
            "en" => $"Certificate {customType}",
            _ => $"Certificat {customType}",
        };
    }

    private static string GetCertificatSignoff(PrintLocale locale)
    {
        return locale.LanguageCode switch
        {
            "ar" => "مع خالص التحية",
            "en" => "Kind regards",
            _ => "Cordialement",
        };
    }

    private static string BuildPatientDisplayNameFirstLast(PrintContext context)
    {
        var fullName = $"{context.PatientFirstName} {context.PatientLastName}".Trim();
        return string.IsNullOrWhiteSpace(fullName) ? "-" : fullName;
    }

    private static string BuildCertificatDoctorDisplayName(PrintContext context, PrintLocale locale)
    {
        var doctorName = $"{context.DoctorFirstName} {context.DoctorLastName}".Trim();
        if (string.IsNullOrWhiteSpace(doctorName))
        {
            return locale.DoctorFallbackLabel;
        }

        return locale.LanguageCode switch
        {
            "ar" => $"{locale.DoctorPrefixArabic} {doctorName}".Trim(),
            "en" => $"Doctor {doctorName}",
            _ => $"Docteur {doctorName}",
        };
    }

    private static string BuildPatientDisplayName(PrintContext context)
    {
        var fullName = $"{context.PatientLastName} {context.PatientFirstName}".Trim();
        return string.IsNullOrWhiteSpace(fullName) ? "-" : fullName;
    }

    private static string BuildDoctorDisplayName(PrintContext context, PrintLocale locale)
    {
        var doctorName = $"{context.DoctorFirstName} {context.DoctorLastName}".Trim();
        if (string.IsNullOrWhiteSpace(doctorName))
        {
            doctorName = locale.DoctorFallbackLabel;
        }

        return $"{locale.DoctorPrefix} {doctorName}".Trim();
    }

    private static string ResolvePatientCivility(string patientSex, PrintLocale locale)
    {
        var isFemale = IsFemaleSex(patientSex);

        return locale.LanguageCode switch
        {
            "ar" => isFemale ? "السيدة" : "السيد",
            "en" => isFemale ? "Ms." : "Mr.",
            _ => isFemale ? "Mme" : "M.",
        };
    }

    private static bool IsFemaleSex(string patientSex)
    {
        var normalizedSex = NormalizeGenericToken(patientSex);
        if (string.IsNullOrWhiteSpace(normalizedSex))
        {
            return false;
        }

        return normalizedSex == "f" ||
               normalizedSex.Contains("femme", StringComparison.Ordinal) ||
               normalizedSex.Contains("female", StringComparison.Ordinal) ||
               normalizedSex.Contains("woman", StringComparison.Ordinal) ||
               normalizedSex.Contains("feminin", StringComparison.Ordinal) ||
               normalizedSex.Contains("feminine", StringComparison.Ordinal) ||
               normalizedSex.Contains("انثى", StringComparison.Ordinal);
    }

    private static string FormatPayloadDate(string rawDateValue, PrintLocale locale, string fallback)
    {
        if (string.IsNullOrWhiteSpace(rawDateValue))
        {
            return fallback;
        }

        if (TryParsePayloadDate(rawDateValue, out var parsedDate))
        {
            return FormatDate(parsedDate, locale, includeTime: false);
        }

        return rawDateValue.Trim();
    }

    private static bool TryParsePayloadDate(string value, out DateTime parsedDate)
    {
        var trimmedValue = value.Trim();

        if (DateTime.TryParse(
                trimmedValue,
                CultureInfo.InvariantCulture,
                DateTimeStyles.AllowWhiteSpaces | DateTimeStyles.AssumeLocal,
                out parsedDate))
        {
            return true;
        }

        var supportedFormats = new[]
        {
            "yyyy-MM-ddTHH:mm",
            "yyyy-MM-ddTHH:mm:ss",
            "yyyy-MM-ddTHH:mm:ss.fff",
            "yyyy-MM-dd",
            "dd/MM/yyyy",
            "MM/dd/yyyy",
        };

        return DateTime.TryParseExact(
            trimmedValue,
            supportedFormats,
            CultureInfo.InvariantCulture,
            DateTimeStyles.AllowWhiteSpaces | DateTimeStyles.AssumeLocal,
            out parsedDate);
    }

    private static string GetCertificatTypeTitle(string certificatTypeKey, PrintLocale locale)
    {
        return (certificatTypeKey, locale.LanguageCode) switch
        {
            ("rest", "ar") => "شهادة طبية للراحة",
            ("presence", "ar") => "شهادة طبية للحضور",
            ("accompaniment", "ar") => "شهادة مرافقة",

            ("rest", "en") => "Medical rest certificate",
            ("presence", "en") => "Medical attendance certificate",
            ("accompaniment", "en") => "Accompaniment certificate",

            ("rest", _) => "Certificat médical de repos",
            ("presence", _) => "Certificat médical de présence",
            ("accompaniment", _) => "Certificat d'accompagnement",
            _ => locale.CertificatTitle,
        };
    }

    private static string GetNoCertificatRecordedMessage(PrintLocale locale)
    {
        return locale.LanguageCode switch
        {
            "ar" => "لا توجد شهادة طبية مسجلة.",
            "en" => "No medical certificate recorded.",
            _ => "Aucun certificat enregistre.",
        };
    }

    private static string GetCertificateDateLabel(PrintLocale locale)
    {
        return locale.LanguageCode switch
        {
            "ar" => "تاريخ الشهادة",
            "en" => "Certificate date",
            _ => "Date certificat",
        };
    }

    private static string GetCertificateLegalSentence(PrintLocale locale)
    {
        return locale.LanguageCode switch
        {
            "ar" => "حررت هذه الشهادة للاستظهار بها عند الاقتضاء.",
            "en" => "This certificate has been issued for legal use.",
            _ => "Ce certificat est delivre pour servir et valoir ce que de droit.",
        };
    }

    private static string GetPresenceCertificateLegalSentence(PrintLocale locale)
    {
        return locale.LanguageCode switch
        {
            "ar" => "تم تحرير هذه الشهادة بطلب من المعني(ة) للاستظهار بها عند الاقتضاء.",
            "en" => "This certificate has been issued at the patient's request for legal purposes.",
            _ => "Ce certificat a ete etabli a la demande de l'interesse pour faire valoir ce que de droit.",
        };
    }

    private static string NormalizeGenericToken(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        var decomposed = value
            .Trim()
            .ToLowerInvariant()
            .Normalize(NormalizationForm.FormD);

        var builder = new StringBuilder(decomposed.Length);
        foreach (var ch in decomposed)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) == UnicodeCategory.NonSpacingMark)
            {
                continue;
            }

            if (char.IsLetterOrDigit(ch))
            {
                builder.Append(ch);
            }
        }

        return builder
            .ToString()
            .Normalize(NormalizationForm.FormC);
    }

    private static string BuildParacliniqueBody(PrintContext context)
    {
        context.ActionsByKey.TryGetValue(ConduiteActionKeys.ParacliniqueChirurgie, out var chirurgie);
        context.ActionsByKey.TryGetValue(ConduiteActionKeys.ParacliniqueLaser, out var laser);
        context.ActionsByKey.TryGetValue(ConduiteActionKeys.ParacliniqueImagerie, out var imagerie);
        context.ActionsByKey.TryGetValue(ConduiteActionKeys.ParacliniqueBilanSanguin, out var bilanSanguin);

        if (chirurgie is null && laser is null && imagerie is null && bilanSanguin is null)
        {
            return "<div class=\"body-block\"><h3>Paraclinique</h3><p>Aucun acte paraclinique enregistré.</p></div>";
        }

        var notes = new List<(string Type, string Information)>();
        var bilanDetails = new List<BilanTypePrintItem>();

        var sb = new StringBuilder();
        sb.Append("<div class=\"body-block\"><h3>Paraclinique</h3>");
        sb.Append("<table>");
        sb.Append("<thead><tr>");
        sb.Append("<th>Type d'opération</th>");
        sb.Append("<th>Acte</th>");
        sb.Append("<th>Date</th>");
        sb.Append("<th>Heure</th>");
        sb.Append("<th>Clinique</th>");
        sb.Append("<th>Forfait</th>");
        sb.Append("<th>Opérateur</th>");
        sb.Append("</tr></thead>");
        sb.Append("<tbody>");

        if (chirurgie is not null)
        {
            sb.Append(RenderParacliniqueTableRow(
                operationType: "Chirurgie",
                payload: chirurgie.Payload,
                isBilan: false,
                showClinique: true,
                showForfait: true,
                showOperateur: true));

            var chirurgieInformation = ReadString(chirurgie.Payload, "informationAdditionnel");
            if (!string.IsNullOrWhiteSpace(chirurgieInformation))
            {
                notes.Add(("Chirurgie", chirurgieInformation));
            }
        }

        if (laser is not null)
        {
            sb.Append(RenderParacliniqueTableRow(
                operationType: "Laser",
                payload: laser.Payload,
                isBilan: false,
                showClinique: true,
                showForfait: true,
                showOperateur: true));

            var laserInformation = ReadString(laser.Payload, "informationAdditionnel");
            if (!string.IsNullOrWhiteSpace(laserInformation))
            {
                notes.Add(("Laser", laserInformation));
            }
        }

        if (imagerie is not null)
        {
            sb.Append(RenderParacliniqueTableRow(
                operationType: "Imagerie",
                payload: imagerie.Payload,
                isBilan: false,
                showClinique: false,
                showForfait: false,
                showOperateur: false));

            var imagerieInformation = ReadString(imagerie.Payload, "informationAdditionnel");
            if (!string.IsNullOrWhiteSpace(imagerieInformation))
            {
                notes.Add(("Imagerie", imagerieInformation));
            }
        }

        if (bilanSanguin is not null)
        {
            sb.Append(RenderParacliniqueTableRow(
                operationType: "Bilan sanguin",
                payload: bilanSanguin.Payload,
                isBilan: true,
                showClinique: false,
                showForfait: false,
                showOperateur: false));

            var bilanInformation = ReadString(bilanSanguin.Payload, "informationAdditionnel");
            if (!string.IsNullOrWhiteSpace(bilanInformation))
            {
                notes.Add(("Bilan sanguin", bilanInformation));
            }

            bilanDetails = ReadBilanTypePrintItems(bilanSanguin.Payload);
        }

        sb.Append("</tbody></table>");

        if (notes.Count > 0)
        {
            sb.Append("<div class=\"body-block\">");
            sb.Append("<h3>Informations additionnelles</h3>");
            sb.Append("<ul>");
            foreach (var note in notes)
            {
                sb.Append($"<li><span class=\"label\">{EscapeHtml(note.Type)}:</span> {Nl2Br(note.Information)}</li>");
            }
            sb.Append("</ul>");
            sb.Append("</div>");
        }

        if (bilanDetails.Count > 0)
        {
            sb.Append("<div class=\"body-block\">");
            sb.Append("<h3>Bilan sanguin - détails</h3>");
            foreach (var type in bilanDetails)
            {
                sb.Append($"<p class=\"label\">{EscapeHtml(type.Name)}</p>");
                sb.Append("<ul>");
                foreach (var checkedLabel in type.CheckedLabels)
                {
                    sb.Append($"<li>{EscapeHtml(checkedLabel)}</li>");
                }
                sb.Append("</ul>");
            }
            sb.Append("</div>");
        }

        sb.Append("</div>");
        return sb.ToString();
    }

    private static string RenderParacliniqueTableRow(
        string operationType,
        Dictionary<string, JsonElement> payload,
        bool isBilan,
        bool showClinique,
        bool showForfait,
        bool showOperateur)
    {
        var acte = ResolveParacliniqueActe(payload, isBilan);
        var (date, heure) = ResolveParacliniqueDateAndTime(payload);
        var clinique = showClinique
            ? DefaultIfEmpty(ReadString(payload, "clinique"), "-")
            : "-";
        var forfait = showForfait
            ? DefaultIfEmpty(ReadString(payload, "forfait"), "-")
            : "-";
        var operateur = showOperateur
            ? DefaultIfEmpty(ReadString(payload, "operateur"), "-")
            : "-";

        var sb = new StringBuilder();
        sb.Append("<tr>");
        sb.Append($"<td>{EscapeHtml(operationType)}</td>");
        sb.Append($"<td>{EscapeHtml(acte)}</td>");
        sb.Append($"<td>{EscapeHtml(date)}</td>");
        sb.Append($"<td>{EscapeHtml(heure)}</td>");
        sb.Append($"<td>{EscapeHtml(clinique)}</td>");
        sb.Append($"<td>{EscapeHtml(forfait)}</td>");
        sb.Append($"<td>{EscapeHtml(operateur)}</td>");
        sb.Append("</tr>");
        return sb.ToString();
    }

    private static string ResolveParacliniqueActe(
        Dictionary<string, JsonElement> payload,
        bool isBilan)
    {
        if (isBilan)
        {
            var bilanTypeNames = ReadBilanTypePrintItems(payload)
                .Select(type => type.Name)
                .Where(name => !string.IsNullOrWhiteSpace(name))
                .ToList();

            if (bilanTypeNames.Count > 0)
            {
                return string.Join(", ", bilanTypeNames);
            }
        }

        var typeNames = ReadTypeNames(payload, "types");
        if (typeNames.Count == 0)
        {
            var legacyType = ReadString(payload, "type");
            if (!string.IsNullOrWhiteSpace(legacyType))
            {
                typeNames.Add(legacyType);
            }
        }

        return typeNames.Count > 0
            ? string.Join(", ", typeNames)
            : "-";
    }

    private static List<string> ReadTypeNames(Dictionary<string, JsonElement> payload, string key)
    {
        var result = new List<string>();
        foreach (var item in ReadArray(payload, key))
        {
            if (item.ValueKind == JsonValueKind.String)
            {
                var directValue = ReadString(item);
                if (!string.IsNullOrWhiteSpace(directValue) && !result.Contains(directValue))
                {
                    result.Add(directValue);
                }
                continue;
            }

            var objectValue = ReadString(item, "name");
            if (string.IsNullOrWhiteSpace(objectValue))
            {
                objectValue = ReadString(item, "label");
            }

            if (!string.IsNullOrWhiteSpace(objectValue) && !result.Contains(objectValue))
            {
                result.Add(objectValue);
            }
        }

        return result;
    }

    private static (string Date, string Time) ResolveParacliniqueDateAndTime(
        Dictionary<string, JsonElement> payload)
    {
        var rawDate = ReadString(payload, "dateOperation");
        if (string.IsNullOrWhiteSpace(rawDate))
        {
            rawDate = ReadString(payload, "date");
        }

        if (string.IsNullOrWhiteSpace(rawDate))
        {
            return ("-", "-");
        }

        if (TryParsePayloadDate(rawDate, out var parsedDate))
        {
            return (
                parsedDate.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture),
                parsedDate.ToString("HH:mm", CultureInfo.InvariantCulture));
        }

        var trimmedDate = rawDate.Trim();
        var datePart = trimmedDate;
        var timePart = "-";

        var tSeparatorIndex = trimmedDate.IndexOf('T', StringComparison.Ordinal);
        if (tSeparatorIndex < 0)
        {
            tSeparatorIndex = trimmedDate.IndexOf(' ', StringComparison.Ordinal);
        }

        if (tSeparatorIndex > 0)
        {
            datePart = trimmedDate.Substring(0, tSeparatorIndex);
            var rawTimePart = trimmedDate.Substring(tSeparatorIndex + 1).Trim();
            if (!string.IsNullOrWhiteSpace(rawTimePart))
            {
                timePart = rawTimePart.Length >= 5
                    ? rawTimePart.Substring(0, 5)
                    : rawTimePart;
            }
        }

        return (
            string.IsNullOrWhiteSpace(datePart) ? "-" : datePart,
            string.IsNullOrWhiteSpace(timePart) ? "-" : timePart);
    }

    private static List<BilanTypePrintItem> ReadBilanTypePrintItems(
        Dictionary<string, JsonElement> payload)
    {
        var result = new List<BilanTypePrintItem>();

        var selectedBilanTypes = ReadArray(payload, "selectedBilanTypes");
        foreach (var selectedType in selectedBilanTypes)
        {
            if (selectedType.ValueKind != JsonValueKind.Object)
            {
                continue;
            }

            var key = ReadString(selectedType, "key");
            var name = ReadString(selectedType, "name");
            if (string.IsNullOrWhiteSpace(name))
            {
                name = key;
            }

            if (string.IsNullOrWhiteSpace(name))
            {
                continue;
            }

            var checkedLabels = new List<string>();
            var checkboxValues = ReadObject(selectedType, "checkboxValues");
            var checkboxValueMap = new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase);

            if (checkboxValues.ValueKind == JsonValueKind.Object)
            {
                foreach (var property in checkboxValues.EnumerateObject())
                {
                    checkboxValueMap[property.Name] = ReadBoolean(property.Value);
                }
            }

            var checkboxDefinitions = ReadArray(selectedType, "checkboxDefinitions");
            if (checkboxDefinitions.Count > 0)
            {
                foreach (var definition in checkboxDefinitions)
                {
                    if (definition.ValueKind != JsonValueKind.Object)
                    {
                        continue;
                    }

                    var definitionKey = ReadString(definition, "key");
                    if (string.IsNullOrWhiteSpace(definitionKey))
                    {
                        continue;
                    }

                    if (!checkboxValueMap.TryGetValue(definitionKey, out var isChecked) || !isChecked)
                    {
                        continue;
                    }

                    var label = ReadString(definition, "label");
                    checkedLabels.Add(string.IsNullOrWhiteSpace(label) ? definitionKey : label);
                }
            }
            else
            {
                checkedLabels.AddRange(
                    checkboxValueMap
                        .Where(entry => entry.Value)
                        .Select(entry => entry.Key));
            }

            if (checkedLabels.Count == 0)
            {
                continue;
            }

            result.Add(new BilanTypePrintItem
            {
                Name = name,
                CheckedLabels = checkedLabels,
            });
        }

        if (result.Count > 0)
        {
            return result;
        }

        var excludedKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "dateOperation",
            "date",
            "type",
            "types",
            "clinique",
            "forfait",
            "operateur",
            "informationAdditionnel",
            "selectedBilanTypes",
            "oeil",
        };

        foreach (var payloadEntry in payload)
        {
            if (excludedKeys.Contains(payloadEntry.Key) || payloadEntry.Value.ValueKind != JsonValueKind.Object)
            {
                continue;
            }

            var checkedLabels = new List<string>();
            foreach (var checkboxEntry in payloadEntry.Value.EnumerateObject())
            {
                if (ReadBoolean(checkboxEntry.Value))
                {
                    checkedLabels.Add(checkboxEntry.Name);
                }
            }

            if (checkedLabels.Count == 0)
            {
                continue;
            }

            result.Add(new BilanTypePrintItem
            {
                Name = payloadEntry.Key,
                CheckedLabels = checkedLabels,
            });
        }

        return result;
    }

    private static string BuildFileName(string documentType, PrintContext context)
    {
        var patientToken = SanitizeFileToken($"{context.PatientLastName}_{context.PatientFirstName}");
        var dateToken = context.ConsultationDate.ToString("yyyyMMdd", CultureInfo.InvariantCulture);
        return $"{documentType}_{patientToken}_{dateToken}.html";
    }

    private static string GetDocumentTitle(string documentType, PrintLocale locale)
    {
        return documentType switch
        {
            "ordonnance" => locale.OrdonnanceTitle,
            "certificat" => locale.CertificatTitle,
            "lettre_confrere" => locale.LettreConfrereTitle,
            "paraclinique" => locale.ParacliniqueTitle,
            _ => locale.DocumentTitle,
        };
    }

    private static PrintLocale ResolvePrintLocale(string? requestedLanguage, string? doctorLanguagePreference)
    {
        var normalizedLanguage = NormalizeLanguageCode(requestedLanguage);
        if (string.IsNullOrWhiteSpace(normalizedLanguage))
        {
            normalizedLanguage = NormalizeLanguageCode(doctorLanguagePreference);
        }

        return normalizedLanguage switch
        {
            "ar" => new PrintLocale
            {
                LanguageCode = "ar",
                Direction = "rtl",
                DateFormat = "dd/MM/yyyy",
                DateTimeFormat = "dd/MM/yyyy HH:mm",
                DoctorPrefix = "د.",
                DoctorPrefixArabic = "الدكتور",
                DoctorFallbackLabel = "طبيب",
                CnamLabel = "رمز CNAM",
                PatientLabel = "المريض",
                PatientSalutationLabel = "السيد/السيدة:",
                RecordLabel = "الملف",
                AgeLabel = "العمر",
                ConsultationDateLabel = "تاريخ الاستشارة",
                AddressLabel = "العنوان",
                LandlineLabel = "هاتف ثابت",
                MobileLabel = "جوال",
                EmailLabel = "البريد الإلكتروني",
                PrintButtonLabel = "طباعة",
                ConsigneLabel = "تعليمات",
                AdditionalInformationLabel = "معلومات إضافية",
                NoOrdonnanceRecordedMessage = "لا توجد وصفة مسجلة.",
                NoMedicationRecordedMessage = "لم يتم إدخال أي دواء.",
                OrdonnanceTitle = "وصفة طبية",
                CertificatTitle = "شهادة طبية",
                LettreConfrereTitle = "رسالة إلى زميل",
                ParacliniqueTitle = "فحوصات متممة",
                DocumentTitle = "وثيقة",
            },
            "en" => new PrintLocale
            {
                LanguageCode = "en",
                Direction = "ltr",
                DateFormat = "MM/dd/yyyy",
                DateTimeFormat = "MM/dd/yyyy hh:mm tt",
                DoctorPrefix = "Dr.",
                DoctorPrefixArabic = "Doctor",
                DoctorFallbackLabel = "Doctor",
                CnamLabel = "CNAM Code",
                PatientLabel = "Patient",
                PatientSalutationLabel = "Mr/Ms:",
                RecordLabel = "Record",
                AgeLabel = "Age",
                ConsultationDateLabel = "Consultation date",
                AddressLabel = "Address",
                LandlineLabel = "Landline",
                MobileLabel = "Mobile",
                EmailLabel = "Email",
                PrintButtonLabel = "Print",
                ConsigneLabel = "Instruction",
                AdditionalInformationLabel = "Additional information",
                NoOrdonnanceRecordedMessage = "No prescription recorded.",
                NoMedicationRecordedMessage = "No medication entered.",
                OrdonnanceTitle = "Prescription",
                CertificatTitle = "Medical certificate",
                LettreConfrereTitle = "Colleague letter",
                ParacliniqueTitle = "Paraclinical",
                DocumentTitle = "Document",
            },
            _ => new PrintLocale
            {
                LanguageCode = "fr",
                Direction = "ltr",
                DateFormat = "dd/MM/yyyy",
                DateTimeFormat = "dd/MM/yyyy HH:mm",
                DoctorPrefix = "Dr.",
                DoctorPrefixArabic = "الدكتور",
                DoctorFallbackLabel = "Medecin",
                CnamLabel = "Code CNAM",
                PatientLabel = "Patient",
                PatientSalutationLabel = "Madame/Monsieur:",
                RecordLabel = "Dossier",
                AgeLabel = "Age",
                ConsultationDateLabel = "Date consultation",
                AddressLabel = "Adresse",
                LandlineLabel = "Tel fixe",
                MobileLabel = "Tel mobile",
                EmailLabel = "Email",
                PrintButtonLabel = "Imprimer",
                ConsigneLabel = "Consigne",
                AdditionalInformationLabel = "Information additionnelle",
                NoOrdonnanceRecordedMessage = "Aucune ordonnance enregistree.",
                NoMedicationRecordedMessage = "Aucun medicament saisi.",
                OrdonnanceTitle = "Ordonnance",
                CertificatTitle = "Certificat",
                LettreConfrereTitle = "Lettre pour confrère",
                ParacliniqueTitle = "Paraclinique",
                DocumentTitle = "Document",
            },
        };
    }

    private static readonly IReadOnlyList<KnownOrdonnanceValueTranslation> KnownOrdonnanceValueTranslations =
    [
        KnownValue("Amoxicilline 1 g (Clamoxyl)", "Amoxicillin 1 g (Clamoxyl)", "أموكسيسيلين 1 غ (Clamoxyl)"),
        KnownValue("Paracétamol 1 g (Doliprane)", "Paracetamol 1 g (Doliprane)", "باراسيتامول 1 غ (Doliprane)"),
        KnownValue("Ibuprofène 400 mg (Brufen)", "Ibuprofen 400 mg (Brufen)", "إيبوبروفين 400 مغ (Brufen)"),
        KnownValue("Cétirizine 10 mg", "Cetirizine 10 mg", "سيتيريزين 10 مغ"),
        KnownValue("Sérum physiologique nasal", "Nasal saline solution", "محلول ملحي أنفي"),
        KnownValue("Budésonide spray nasal 64 mcg", "Budesonide nasal spray 64 mcg", "بوديزونيد بخاخ أنفي 64 مكغ"),
        KnownValue("SRO (sels de réhydratation orale)", "ORS (oral rehydration salts)", "محلول الإماهة الفموية (ORS)"),
        KnownValue("Racécadotril 100 mg (Tiorfan)", "Racecadotril 100 mg (Tiorfan)", "راسيكادوتريل 100 مغ (Tiorfan)"),
        KnownValue("Phloroglucinol 80 mg (Spasfon)", "Phloroglucinol 80 mg (Spasfon)", "فلوروغلوسينول 80 مغ (Spasfon)"),
        KnownValue("Fosfomycine trométamol 3 g (Monuril)", "Fosfomycin trometamol 3 g (Monuril)", "فوسفوميسين تروميتامول 3 غ (Monuril)"),
        KnownValue("Nitrofurantoine 100 mg", "Nitrofurantoin 100 mg", "نيتروفورانتوين 100 مغ"),
        KnownValue("Salbutamol inhalateur 100 mcg", "Salbutamol inhaler 100 mcg", "سالبتامول بخاخ 100 مكغ"),
        KnownValue("Prednisone 20 mg", "Prednisone 20 mg", "بريدنيزون 20 مغ"),

        KnownValue("1 gtt x 3 jours", "1 drop x 3 days", "1 قطرة x 3 أيام", "1 gtt * 3 jours"),
        KnownValue("1 gtt x 5 jours", "1 drop x 5 days", "1 قطرة x 5 أيام", "1 gtt * 5 jours"),
        KnownValue("1 gtt x 7 jours", "1 drop x 7 days", "1 قطرة x 7 أيام", "1 gtt * 7 jours"),
        KnownValue("2 gtt x 5 jours", "2 drops x 5 days", "2 قطرة x 5 أيام", "2 gtt * 5 jours"),
        KnownValue("2 gtt x 7 jours", "2 drops x 7 days", "2 قطرة x 7 أيام", "2 gtt * 7 jours"),
        KnownValue("1 cp x 1/j", "1 tablet x 1/day", "1 قرص x 1/اليوم", "1 cp * 1/j"),
        KnownValue("1 cp x 2/j", "1 tablet x 2/day", "1 قرص x 2/اليوم", "1 cp * 2/j"),
        KnownValue("1 cp x 3/j", "1 tablet x 3/day", "1 قرص x 3/اليوم", "1 cp * 3/j"),
        KnownValue("5 ml x 3/j", "5 ml x 3/day", "5 مل x 3/اليوم", "5 ml * 3/j"),
        KnownValue("Au besoin (PRN)", "As needed (PRN)", "عند اللزوم (PRN)"),
        KnownValue("1 cp si fièvre/douleur, max 3/j", "1 tablet for fever/pain, max 3/day", "1 قرص عند الحمى/الألم، حد أقصى 3/اليوم"),
        KnownValue("1 cp toutes les 8h si besoin", "1 tablet every 8 hours if needed", "1 قرص كل 8 ساعات عند الحاجة"),
        KnownValue("Lavage nasal 3-4 fois/j", "Nasal wash 3-4 times/day", "غسل أنف 3-4 مرات/اليوم"),
        KnownValue("Lavage nasal 4 fois/j", "Nasal wash 4 times/day", "غسل أنف 4 مرات/اليوم"),
        KnownValue("1 cp le soir", "1 tablet in the evening", "1 قرص مساء"),
        KnownValue("1 cp si douleur/fièvre, max 3/j", "1 tablet for pain/fever, max 3/day", "1 قرص عند الألم/الحمى، حد أقصى 3/اليوم"),
        KnownValue("Après chaque selle liquide", "After each loose stool", "بعد كل براز سائل"),
        KnownValue("1 gélule x 3/j", "1 capsule x 3/day", "1 كبسولة x 3/اليوم"),
        KnownValue("1 cp x 2/j si douleurs", "1 tablet x 2/day if pain", "1 قرص x 2/اليوم عند الألم"),
        KnownValue("1 sachet dose unique", "1 sachet single dose", "كيس واحد جرعة وحيدة"),
        KnownValue("1-2 bouffées si besoin", "1-2 puffs if needed", "1-2 بخة عند الحاجة"),
        KnownValue("1 cp/j le matin", "1 tablet/day in the morning", "1 قرص/اليوم صباحا"),

        KnownValue("05 jours", "05 days", "05 أيام"),
        KnownValue("07 jours", "07 days", "07 أيام"),
        KnownValue("10 jours", "10 days", "10 أيام"),
        KnownValue("02 semaines", "02 weeks", "02 أسابيع"),
        KnownValue("03 semaines", "03 weeks", "03 أسابيع"),
        KnownValue("01 mois", "01 month", "01 شهر"),
        KnownValue("06 jours", "06 days", "06 أيام"),
        KnownValue("03 jours", "03 days", "03 أيام"),
        KnownValue("01 jour", "01 day", "01 يوم"),

        KnownValue(
            "Boire abondamment, terminer l'antibiotique et consulter si aggravation.",
            "Drink plenty of fluids, complete the antibiotic course, and consult if symptoms worsen.",
            "اشرب سوائل بكثرة، أكمل المضاد الحيوي، وراجع الطبيب عند التدهور."),
        KnownValue(
            "Éviter l'automédication antibiotique.",
            "Avoid antibiotic self-medication.",
            "تجنب التداوي الذاتي بالمضادات الحيوية."),
        KnownValue(
            "Repos, hydratation, surveiller la fièvre.",
            "Rest, hydrate well, and monitor fever.",
            "راحة، إماهة جيدة، ومراقبة الحرارة."),
        KnownValue(
            "Réévaluation médicale si dyspnée ou fièvre persistante.",
            "Medical reevaluation if dyspnea appears or fever persists.",
            "إعادة تقييم طبي عند ظهور ضيق نفس أو استمرار الحمى."),
        KnownValue(
            "Hydratation et lavage nasal réguliers.",
            "Hydration and regular nasal washing.",
            "إماهة وغسل أنف منتظمان."),
        KnownValue(
            "Consulter en cas de douleur sinusienne intense ou fièvre prolongée.",
            "Consult if severe sinus pain or prolonged fever occurs.",
            "راجع الطبيب عند ألم جيوب شديد أو حمى مطولة."),
        KnownValue(
            "Fractionner les prises, prioriser la réhydratation orale.",
            "Split intakes and prioritize oral rehydration.",
            "قسّم الجرعات وركّز على الإماهة الفموية."),
        KnownValue(
            "Urgences si signes de déshydratation ou sang dans les selles.",
            "Emergency care if signs of dehydration or blood in stool appear.",
            "الطوارئ عند ظهور علامات تجفاف أو دم في البراز."),
        KnownValue(
            "Boire 1,5 à 2 litres d'eau par jour.",
            "Drink 1.5 to 2 liters of water per day.",
            "اشرب من 1.5 إلى 2 لتر ماء يوميا."),
        KnownValue(
            "Faire un contrôle si persistance des symptômes à 48h.",
            "Recheck if symptoms persist after 48 hours.",
            "أعد الفحص إذا استمرت الأعراض بعد 48 ساعة."),
        KnownValue(
            "Hydratation, arrêt du tabac et surveillance respiratoire.",
            "Hydration, smoking cessation, and respiratory monitoring.",
            "إماهة، إيقاف التدخين، ومراقبة تنفسية."),
        KnownValue(
            "Consulter en urgence en cas de gêne respiratoire importante.",
            "Seek urgent care in case of significant breathing discomfort.",
            "راجع الطوارئ عند صعوبة تنفس واضحة."),
    ];

    private static readonly Dictionary<string, KnownOrdonnanceValueTranslation> KnownOrdonnanceValueTranslationsByAlias =
        BuildKnownOrdonnanceValueTranslationsByAlias();

    private static string TranslateKnownOrdonnanceValue(string value, PrintLocale locale)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        var normalizedValue = NormalizeKnownOrdonnanceValue(value);
        if (!KnownOrdonnanceValueTranslationsByAlias.TryGetValue(normalizedValue, out var translation))
        {
            return value;
        }

        return locale.LanguageCode switch
        {
            "ar" => translation.Ar,
            "en" => translation.En,
            _ => translation.Fr,
        };
    }

    private static Dictionary<string, KnownOrdonnanceValueTranslation> BuildKnownOrdonnanceValueTranslationsByAlias()
    {
        var map = new Dictionary<string, KnownOrdonnanceValueTranslation>(StringComparer.Ordinal);

        foreach (var entry in KnownOrdonnanceValueTranslations)
        {
            RegisterAlias(entry.Fr, entry, map);

            foreach (var alias in entry.Aliases)
            {
                RegisterAlias(alias, entry, map);
            }
        }

        return map;
    }

    private static void RegisterAlias(
        string alias,
        KnownOrdonnanceValueTranslation entry,
        Dictionary<string, KnownOrdonnanceValueTranslation> map)
    {
        var normalizedAlias = NormalizeKnownOrdonnanceValue(alias);
        if (string.IsNullOrWhiteSpace(normalizedAlias) || map.ContainsKey(normalizedAlias))
        {
            return;
        }

        map[normalizedAlias] = entry;
    }

    private static string NormalizeKnownOrdonnanceValue(string value)
    {
        var decomposed = value
            .Trim()
            .ToLowerInvariant()
            .Normalize(NormalizationForm.FormD);

        var builder = new StringBuilder(decomposed.Length);
        foreach (var ch in decomposed)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) == UnicodeCategory.NonSpacingMark)
            {
                continue;
            }

            var normalizedChar = ch is '\'' or '’' or '`'
                ? ' '
                : ch;

            builder.Append(char.IsLetterOrDigit(normalizedChar) ? normalizedChar : ' ');
        }

        var collapsed = builder
            .ToString()
            .Normalize(NormalizationForm.FormC);

        return string.Join(' ', collapsed.Split(' ', StringSplitOptions.RemoveEmptyEntries));
    }

    private static KnownOrdonnanceValueTranslation KnownValue(
        string fr,
        string en,
        string ar,
        params string[] aliases)
    {
        return new KnownOrdonnanceValueTranslation
        {
            Fr = fr,
            En = en,
            Ar = ar,
            Aliases = aliases,
        };
    }

    private static string NormalizeLanguageCode(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        var normalized = value.Trim().ToLowerInvariant();
        if (normalized.StartsWith("ar", StringComparison.Ordinal))
        {
            return "ar";
        }

        if (normalized.StartsWith("en", StringComparison.Ordinal))
        {
            return "en";
        }

        if (normalized.StartsWith("fr", StringComparison.Ordinal))
        {
            return "fr";
        }

        return string.Empty;
    }

    private static string FormatDate(DateTime value, PrintLocale locale, bool includeTime)
    {
        var format = includeTime ? locale.DateTimeFormat : locale.DateFormat;

        try
        {
            var culture = CultureInfo.GetCultureInfo(locale.LanguageCode switch
            {
                "ar" => "ar-TN",
                "en" => "en-US",
                _ => "fr-FR",
            });

            return value.ToString(format, culture);
        }
        catch (CultureNotFoundException)
        {
            return value.ToString(format, CultureInfo.InvariantCulture);
        }
    }

    private static string SanitizeFileToken(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return "patient";
        }

        var sanitizedChars = value
            .Trim()
            .ToLowerInvariant()
            .Select(ch => char.IsLetterOrDigit(ch) ? ch : '_')
            .ToArray();

        return string.Join(string.Empty, new string(sanitizedChars)
            .Split('_', StringSplitOptions.RemoveEmptyEntries));
    }

    private static int CalculateAge(DateTime dateOfBirth)
    {
        var today = DateTime.UtcNow.Date;
        var age = today.Year - dateOfBirth.Year;

        if (dateOfBirth.Date > today.AddYears(-age))
        {
            age--;
        }

        return Math.Max(0, age);
    }

    private static List<JsonElement> ReadArray(Dictionary<string, JsonElement> payload, string key)
    {
        if (!payload.TryGetValue(key, out var element) || element.ValueKind != JsonValueKind.Array)
        {
            return [];
        }

        return element.EnumerateArray().ToList();
    }

    private static List<JsonElement> ReadArray(JsonElement source, string propertyName)
    {
        if (source.ValueKind != JsonValueKind.Object ||
            !source.TryGetProperty(propertyName, out var property) ||
            property.ValueKind != JsonValueKind.Array)
        {
            return [];
        }

        return property.EnumerateArray().ToList();
    }

    private static JsonElement ReadObject(Dictionary<string, JsonElement> payload, string key)
    {
        if (!payload.TryGetValue(key, out var element) || element.ValueKind != JsonValueKind.Object)
        {
            return default;
        }

        return element;
    }

    private static JsonElement ReadObject(JsonElement source, string propertyName)
    {
        if (source.ValueKind != JsonValueKind.Object ||
            !source.TryGetProperty(propertyName, out var property) ||
            property.ValueKind != JsonValueKind.Object)
        {
            return default;
        }

        return property;
    }

    private static string ReadString(Dictionary<string, JsonElement> payload, string key)
    {
        if (!payload.TryGetValue(key, out var element))
        {
            return string.Empty;
        }

        return ReadString(element);
    }

    private static string ReadString(JsonElement source, string propertyName)
    {
        if (source.ValueKind != JsonValueKind.Object || !source.TryGetProperty(propertyName, out var property))
        {
            return string.Empty;
        }

        return ReadString(property);
    }

    private static string ReadString(JsonElement element)
    {
        return element.ValueKind switch
        {
            JsonValueKind.String => element.GetString()?.Trim() ?? string.Empty,
            JsonValueKind.Number => element.ToString(),
            JsonValueKind.True => "true",
            JsonValueKind.False => "false",
            _ => string.Empty,
        };
    }

    private static bool ReadBoolean(JsonElement element)
    {
        return element.ValueKind switch
        {
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.String => bool.TryParse(element.GetString(), out var parsedBool) && parsedBool,
            JsonValueKind.Number => element.TryGetInt32(out var parsedNumber) && parsedNumber != 0,
            _ => false,
        };
    }

    private static string DefaultIfEmpty(string value, string fallback)
    {
        return string.IsNullOrWhiteSpace(value) ? fallback : value;
    }

    private static string EscapeHtml(string value)
    {
        return value
            .Replace("&", "&amp;", StringComparison.Ordinal)
            .Replace("<", "&lt;", StringComparison.Ordinal)
            .Replace(">", "&gt;", StringComparison.Ordinal)
            .Replace("\"", "&quot;", StringComparison.Ordinal)
            .Replace("'", "&#39;", StringComparison.Ordinal);
    }

    private static string Nl2Br(string value)
    {
        return EscapeHtml(value).Replace("\n", "<br />", StringComparison.Ordinal);
    }

    private sealed class PrintContext
    {
        public Guid ConsultationId { get; init; }
        public DateTime ConsultationDate { get; init; }
        public string PatientFirstName { get; init; } = string.Empty;
        public string PatientLastName { get; init; } = string.Empty;
        public string PatientSex { get; init; } = string.Empty;
        public DateTime PatientDateOfBirth { get; init; }
        public int PatientDossierNumber { get; init; }
        public string CabinetAddress { get; init; } = string.Empty;
        public string CabinetCity { get; init; } = string.Empty;
        public string CabinetCountry { get; init; } = string.Empty;
        public string CabinetEmail { get; init; } = string.Empty;
        public string CabinetCodeCnam { get; init; } = string.Empty;
        public string DoctorFirstName { get; init; } = string.Empty;
        public string DoctorLastName { get; init; } = string.Empty;
        public string DoctorFirstNameArabic { get; init; } = string.Empty;
        public string DoctorLastNameArabic { get; init; } = string.Empty;
        public string DoctorLandline { get; init; } = string.Empty;
        public string DoctorPhoneNumber { get; init; } = string.Empty;
        public string DoctorLanguagePreference { get; init; } = "fr";
        public IReadOnlyList<PrintClinicInfo> DoctorClinics { get; init; } = [];
        public PrintPersonalization Personalization { get; init; } = new();
        public Dictionary<string, ConsultationConduiteAction> ActionsByKey { get; init; } =
            new(StringComparer.OrdinalIgnoreCase);
    }

    private sealed class PrintClinicInfo
    {
        public string Name { get; init; } = string.Empty;
        public string Address { get; init; } = string.Empty;
        public string PhoneNumber { get; init; } = string.Empty;
        public string GoogleMapsLink { get; init; } = string.Empty;
    }

    private sealed class PrintPersonalization
    {
        public bool ShowHeader { get; init; } = true;
        public bool ShowFirstName { get; init; } = true;
        public bool ShowLastName { get; init; } = true;
        public bool ShowCodeCnam { get; init; } = true;
        public bool ShowFirstNameArabic { get; init; }
        public bool ShowLastNameArabic { get; init; }
        public bool ShowFooter { get; init; } = true;
        public bool ShowFooterCabinetAddress { get; init; } = true;
        public bool ShowFooterLandline { get; init; } = true;
        public bool ShowFooterMobile { get; init; } = true;
        public bool ShowFooterEmail { get; init; } = true;
    }

    private sealed class OrdonnanceDrugLine
    {
        public string Name { get; init; } = string.Empty;
        public string Posology { get; init; } = string.Empty;
        public string Eye { get; init; } = string.Empty;
        public string Duration { get; init; } = string.Empty;
    }

    private sealed class BilanTypePrintItem
    {
        public string Name { get; init; } = string.Empty;
        public IReadOnlyList<string> CheckedLabels { get; init; } = [];
    }

    private enum PrintFooterContactKind
    {
        Landline,
        Mobile,
        Email,
    }

    private sealed class PrintFooterContactItem
    {
        public PrintFooterContactKind Kind { get; init; }
        public string Value { get; init; } = string.Empty;
    }

    private sealed class KnownOrdonnanceValueTranslation
    {
        public string Fr { get; init; } = string.Empty;
        public string En { get; init; } = string.Empty;
        public string Ar { get; init; } = string.Empty;
        public IReadOnlyList<string> Aliases { get; init; } = [];
    }

    private sealed class PrintLocale
    {
        public string LanguageCode { get; init; } = "fr";
        public string Direction { get; init; } = "ltr";
        public string DateFormat { get; init; } = "dd/MM/yyyy";
        public string DateTimeFormat { get; init; } = "dd/MM/yyyy HH:mm";
        public string DoctorPrefix { get; init; } = "Dr.";
        public string DoctorPrefixArabic { get; init; } = "الدكتور";
        public string DoctorFallbackLabel { get; init; } = "Medecin";
        public string CnamLabel { get; init; } = "Code CNAM";
        public string PatientLabel { get; init; } = "Patient";
        public string PatientSalutationLabel { get; init; } = "Madame/Monsieur:";
        public string RecordLabel { get; init; } = "Dossier";
        public string AgeLabel { get; init; } = "Age";
        public string ConsultationDateLabel { get; init; } = "Date consultation";
        public string AddressLabel { get; init; } = "Adresse";
        public string LandlineLabel { get; init; } = "Tel fixe";
        public string MobileLabel { get; init; } = "Tel mobile";
        public string EmailLabel { get; init; } = "Email";
        public string PrintButtonLabel { get; init; } = "Imprimer";
        public string ConsigneLabel { get; init; } = "Consigne";
        public string AdditionalInformationLabel { get; init; } = "Information additionnelle";
        public string NoOrdonnanceRecordedMessage { get; init; } = "Aucune ordonnance enregistree.";
        public string NoMedicationRecordedMessage { get; init; } = "Aucun medicament saisi.";
        public string OrdonnanceTitle { get; init; } = "Ordonnance";
        public string CertificatTitle { get; init; } = "Certificat";
        public string LettreConfrereTitle { get; init; } = "Lettre pour confrère";
        public string ParacliniqueTitle { get; init; } = "Paraclinique";
        public string DocumentTitle { get; init; } = "Document";
    }
}
