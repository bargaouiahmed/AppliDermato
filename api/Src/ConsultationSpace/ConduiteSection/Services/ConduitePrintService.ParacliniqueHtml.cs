using System.Text;
using System.Text.Json;

namespace api.Src.ConsultationSpace.ConduiteSection.Services;

public partial class ConduitePrintService
{
    private static string BuildParacliniquePrintableHtml(
        PrintContext context,
        PrintLocale locale,
        IReadOnlyCollection<string>? sections = null)
    {
        var requestedSections = ResolveParacliniqueRequestedSections(sections);
        var pages = BuildParacliniquePdfPages(context, locale, requestedSections);

        if (pages.Count == 0)
        {
            throw new InvalidOperationException(GetNoParacliniqueDataMessage(locale));
        }

        var documentTitle = EscapeHtml(locale.ParacliniqueTitle);
        var pageMarkup = new StringBuilder();

        for (var index = 0; index < pages.Count; index += 1)
        {
            pageMarkup.Append(BuildParacliniqueHtmlPage(context, locale, pages[index], index < pages.Count - 1));
        }

        return $$"""
<!doctype html>
<html lang="{{locale.LanguageCode}}" dir="{{locale.Direction}}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{{documentTitle}}</title>
  <style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #111827;
      background: #f3f4f6;
      font-family: "Segoe UI", Tahoma, Arial, "Noto Naskh Arabic", "Noto Sans Arabic", "DejaVu Sans", sans-serif;
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
    .page.page-break {
      page-break-after: always;
      break-after: page;
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
      display: table;
      width: 100%;
      table-layout: fixed;
      border-collapse: separate;
      border-spacing: 0;
    }
    .header-grid > div {
      display: table-cell;
      vertical-align: top;
    }
    .header-grid > div:first-child,
    .header-grid > div:last-child {
      width: 40%;
    }
    .header-grid > div:nth-child(2) {
      width: 20%;
    }
    .header-col-center {
      text-align: center;
      white-space: nowrap;
      padding-top: 2mm;
      padding-inline: 6mm;
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
      unicode-bidi: plaintext;
    }
    .doctor-subtitle,
    .doctor-subtitle-ar {
      margin-top: 2px;
      font-size: 10px;
      line-height: 1.35;
      min-height: 14px;
    }
    .doctor-subtitle-ar {
      text-align: right;
      direction: rtl;
      unicode-bidi: plaintext;
    }
    .accent-line {
      border-top: 2px solid #c89568;
      margin-top: 4px;
    }
    .paraclinique-title {
      margin: 0 0 12px;
      text-align: center;
      color: #175042;
      letter-spacing: 0.4px;
      font-size: 24px;
      font-weight: 700;
    }
    .patient-box,
    .info-box,
    .clinic-card,
    .additional-box {
      border: 1px solid #d1d5db;
      border-radius: 12px;
      padding: 10px 12px;
      background: #ffffff;
    }
    .patient-box {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 12px;
      margin-bottom: 14px;
      font-size: 14px;
      font-weight: 600;
    }
    .section-stack {
      display: flex;
      flex-direction: column;
      gap: 12px;
      flex: 1;
    }
    .salutation-line,
    .inline-meta {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
      line-height: 1.5;
    }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px 16px;
      font-size: 13px;
    }
    .label {
      font-weight: 700;
      color: #175042;
    }
    .section-label {
      margin: 0;
      font-size: 15px;
      font-weight: 700;
      color: #175042;
    }
    .value-list {
      margin: 0;
      padding-inline-start: 18px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 14px;
      line-height: 1.5;
    }
    .plain-line {
      margin: 0;
      font-size: 14px;
      line-height: 1.5;
    }
    .clinic-card {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 16px;
      align-items: center;
    }
    .clinic-details {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .clinic-title {
      margin: 0 0 2px;
      font-size: 15px;
      font-weight: 700;
      color: #175042;
    }
    .qr-image {
      width: 96px;
      height: 96px;
      object-fit: contain;
      display: block;
    }
    .additional-box {
      border-color: #e5e7eb;
    }
    .additional-title {
      margin: 0 0 6px;
      font-size: 14px;
      font-weight: 700;
      color: #175042;
    }
    .bilan-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }
    .bilan-card {
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 10px;
      break-inside: avoid;
    }
    .bilan-card-title {
      margin: 0 0 8px;
      font-size: 14px;
      font-weight: 700;
      color: #175042;
    }
    .bilan-list {
      margin: 0;
      padding-inline-start: 18px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 13px;
      line-height: 1.5;
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
    .footer-contact-item .fa-phone-alt::before { content: "Ã¢ËœÅ½"; }
    .footer-contact-item .fa-mobile-alt::before { content: "Ã°Å¸â€œÂ±"; }
    @media print {
      body { background: #ffffff; }
      .print-toolbar { display: none !important; }
      .page {
        width: 210mm;
        min-height: 297mm;
        margin: 0;
        padding: 12mm 14mm 10mm;
      }
      .header-grid {
        display: table !important;
        width: 100% !important;
        table-layout: fixed !important;
      }
      .header-grid > div {
        display: table-cell !important;
        vertical-align: top !important;
      }
      .header-grid > div:first-child,
      .header-grid > div:last-child {
        width: 40% !important;
      }
      .header-grid > div:nth-child(2) {
        width: 20% !important;
      }
      .patient-box {
        display: grid !important;
        grid-template-columns: 1fr auto !important;
      }
      .info-grid {
        display: grid !important;
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      }
      .clinic-card {
        display: grid !important;
        grid-template-columns: 1fr auto !important;
        align-items: center !important;
      }
      .bilan-grid {
        display: grid !important;
        grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
      }
    }
    @media screen and (max-width: 900px) {
      .page {
        width: 100%;
        min-height: auto;
        padding: 18px;
      }
      .header-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 14px;
      }
      .header-grid > div {
        display: block;
        width: auto !important;
      }
      .patient-box,
      .clinic-card,
      .info-grid,
      .bilan-grid {
        grid-template-columns: 1fr;
      }
      .header-col-center {
        white-space: normal;
      }
      .qr-image {
        margin-inline: auto;
      }
    }
  </style>
</head>
<body>
  <div class="print-toolbar no-print">
    <button type="button" class="print-toolbar-btn" onclick="window.__retryPrint && window.__retryPrint()">{{EscapeHtml(locale.PrintButtonLabel)}}</button>
  </div>
  {{pageMarkup}}
  <script>
    (function () {
      var hasAutoPrinted = false;

      function doPrint() {
        try {
          window.focus();
          window.print();
        } catch (error) {
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
      if (document.readyState === 'complete') {
        setTimeout(autoPrintOnce, 220);
      } else {
        window.addEventListener('load', function () {
          setTimeout(autoPrintOnce, 220);
        }, { once: true });
      }
    })();
  </script>
</body>
</html>
""";
    }

    private static string BuildParacliniqueHtmlPage(
        PrintContext context,
        PrintLocale locale,
        ParacliniquePdfPageData pageData,
        bool pageBreakAfter)
    {
        var patientName = EscapeHtml(BuildPatientDisplayName(context));
        var age = CalculateAge(context.PatientDateOfBirth);
        var title = EscapeHtml(pageData.Title);
        var sectionHtml = BuildParacliniqueHtmlSectionContent(context, locale, pageData);
        var pageClass = pageBreakAfter ? "page page-break" : "page";

        return $$"""
<section class="{{pageClass}}">
  <div class="sheet">
    {{BuildParacliniqueHtmlHeader(context, locale)}}
    <main class="section-stack">
      <h1 class="paraclinique-title">{{title}}</h1>
      <section class="patient-box">
        <div>{{EscapeHtml(locale.PatientLabel)}}: {{patientName}}</div>
        <div>{{EscapeHtml(locale.AgeLabel)}}: {{age}} | {{EscapeHtml(locale.RecordLabel)}}: {{context.PatientDossierNumber}}</div>
      </section>
      {{sectionHtml}}
    </main>
    {{BuildOrdonnanceFooterHtml(context, locale)}}
  </div>
</section>
""";
    }

    private static string BuildParacliniqueHtmlHeader(PrintContext context, PrintLocale locale)
    {
        if (!context.Personalization.ShowHeader)
        {
            return string.Empty;
        }

        var doctorName = BuildPersonalizedDoctorLatinName(context, locale);
        var doctorArabicName = BuildPersonalizedDoctorArabicName(context, locale);
        var cnamValue = BuildPersonalizedCnamValue(context);
        var professionLabel = locale.LanguageCode == "ar"
            ? "\u0637\u0628\u064A\u0628 \u0623\u0645\u0631\u0627\u0636 \u062C\u0644\u062F\u064A\u0629"
            : "Dermatologue";

        var sb = new StringBuilder();
        sb.Append("<header class=\"inaya-header\">");
        sb.Append("<div class=\"header-grid\">");

        sb.Append("<div>");
        sb.Append($"<div class=\"doctor-main\">{EscapeHtml(doctorName)}</div>");
        sb.Append($"<div class=\"doctor-subtitle\">{EscapeHtml(professionLabel)}</div>");
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
            sb.Append("<div class=\"doctor-subtitle-ar\">&#x200F;&nbsp;</div>");
            sb.Append("<div class=\"accent-line\"></div>");
        }
        else
        {
            sb.Append("<div class=\"doctor-main-ar\"></div>");
            sb.Append("<div class=\"doctor-subtitle-ar\"></div>");
            sb.Append("<div class=\"accent-line\"></div>");
        }
        sb.Append("</div>");

        sb.Append("</div>");
        sb.Append($"<div style=\"text-align:center;margin-top:6px;font-size:15px;font-weight:700;color:#6B7280;\">{EscapeHtml(BrandName)}</div>");
        sb.Append("</header>");
        return sb.ToString();
    }

    private static string BuildParacliniqueHtmlSectionContent(
        PrintContext context,
        PrintLocale locale,
        ParacliniquePdfPageData pageData)
    {
        return pageData.Section switch
        {
            ParacliniquePrintSectionKind.Chirurgie => BuildParacliniqueChirurgieHtml(context, locale, pageData.Payload),
            ParacliniquePrintSectionKind.Laser => BuildParacliniqueChirurgieHtml(context, locale, pageData.Payload),
            ParacliniquePrintSectionKind.Imagerie => BuildParacliniqueImagerieHtml(context, locale, pageData.Payload),
            ParacliniquePrintSectionKind.BilanSanguin => BuildParacliniqueBilanHtml(context, locale, pageData.Payload),
            _ => string.Empty,
        };
    }

    private static string BuildParacliniqueChirurgieHtml(
        PrintContext context,
        PrintLocale locale,
        Dictionary<string, JsonElement> payload)
    {
        var acteLabel = EscapeHtml(GetParacliniqueLabel("acte", locale));
        var cliniqueLabel = EscapeHtml(GetParacliniqueLabel("clinique", locale));
        var types = ReadTypeNames(payload, "types");
        if (types.Count == 0)
        {
            var legacyType = ReadString(payload, "type");
            if (!string.IsNullOrWhiteSpace(legacyType))
            {
                types.Add(legacyType);
            }
        }

        var (date, heure) = ResolveParacliniqueDateAndTime(payload);
        var cliniqueRaw = ReadString(payload, "clinique");
        var clinique = DefaultIfEmpty(cliniqueRaw, "-");
        var forfait = DefaultIfEmpty(ReadString(payload, "forfait"), "-");
        var operateur = DefaultIfEmpty(ReadString(payload, "operateur"), "-");
        var info = ReadString(payload, "informationAdditionnel");
        var matchedClinic = ResolveDoctorClinic(context, cliniqueRaw);

        var sb = new StringBuilder();
        sb.Append($"<p class=\"salutation-line\">{EscapeHtml(GetPatientSalutationLine(context, locale))}</p>");
        sb.Append("<section class=\"info-box\"><div class=\"info-grid\">");
        sb.Append(BuildInfoItem(GetParacliniqueLabel("date", locale), date));
        sb.Append(BuildInfoItem(GetParacliniqueLabel("forfait", locale), forfait));
        sb.Append(BuildInfoItem(GetParacliniqueLabel("operateur", locale), operateur));
        sb.Append(BuildInfoItem(GetParacliniqueLabel("time", locale), heure));
        sb.Append("</div></section>");

        sb.Append("<p class=\"section-label\">");
        sb.Append(acteLabel);
        sb.Append(" :</p>");
        if (types.Count == 0)
        {
            sb.Append("<p class=\"plain-line\">-</p>");
        }
        else
        {
            sb.Append("<ul class=\"value-list\">");
            foreach (var type in types)
            {
                sb.Append($"<li>{EscapeHtml(type)}</li>");
            }
            sb.Append("</ul>");
        }

        sb.Append("<p class=\"plain-line\"><span class=\"label\">");
        sb.Append(cliniqueLabel);
        sb.Append(":</span> ");
        sb.Append(EscapeHtml(clinique));
        sb.Append("</p>");

        sb.Append(BuildClinicDetailsHtml(matchedClinic, locale));

        if (!string.IsNullOrWhiteSpace(info))
        {
            sb.Append(BuildAdditionalInformationHtml(locale, info));
        }

        return sb.ToString();
    }

    private static string BuildParacliniqueImagerieHtml(
        PrintContext context,
        PrintLocale locale,
        Dictionary<string, JsonElement> payload)
    {
        var examTypesLabel = EscapeHtml(GetParacliniqueLabel("examTypes", locale));
        var types = ReadTypeNames(payload, "types");
        if (types.Count == 0)
        {
            var legacyType = ReadString(payload, "type");
            if (!string.IsNullOrWhiteSpace(legacyType))
            {
                types.Add(legacyType);
            }
        }

        var (date, heure) = ResolveParacliniqueDateAndTime(payload);
        var cliniqueRaw = ReadString(payload, "clinique");
        var clinique = DefaultIfEmpty(cliniqueRaw, "-");
        var forfait = DefaultIfEmpty(ReadString(payload, "forfait"), "-");
        var info = ReadString(payload, "informationAdditionnel");
        var matchedClinic = ResolveDoctorClinic(context, cliniqueRaw);

        var sb = new StringBuilder();
        sb.Append($"<p class=\"salutation-line\">{EscapeHtml(GetPatientSalutationLine(context, locale))}</p>");
        sb.Append("<section class=\"info-box\"><div class=\"info-grid\">");
        sb.Append(BuildInfoItem(GetParacliniqueLabel("date", locale), date));
        sb.Append(BuildInfoItem(GetParacliniqueLabel("time", locale), heure));
        sb.Append(BuildInfoItem(GetParacliniqueLabel("clinique", locale), clinique));
        sb.Append(BuildInfoItem(GetParacliniqueLabel("forfait", locale), forfait));
        sb.Append("</div></section>");

        sb.Append("<p class=\"section-label\">");
        sb.Append(examTypesLabel);
        sb.Append("</p>");
        if (types.Count == 0)
        {
            sb.Append($"<p class=\"plain-line\">{EscapeHtml(GetParacliniquePlaceholder())}</p>");
        }
        else
        {
            sb.Append("<ul class=\"value-list\">");
            foreach (var type in types)
            {
                sb.Append($"<li>{EscapeHtml(type)}</li>");
            }
            sb.Append("</ul>");
        }

        sb.Append(BuildClinicDetailsHtml(matchedClinic, locale));

        if (!string.IsNullOrWhiteSpace(info))
        {
            sb.Append(BuildAdditionalInformationHtml(locale, info));
        }

        return sb.ToString();
    }

    private static string BuildParacliniqueBilanHtml(
        PrintContext context,
        PrintLocale locale,
        Dictionary<string, JsonElement> payload)
    {
        var (date, heure) = ResolveParacliniqueDateAndTime(payload);
        var displayDate = date == "-" ? FormatDate(context.ConsultationDate, locale, includeTime: false) : date;
        var info = ReadString(payload, "informationAdditionnel");
        var bilanTypes = ReadBilanPdfTypeItems(payload);

        var sb = new StringBuilder();
        sb.Append("<section class=\"info-box\"><div class=\"info-grid\">");
        sb.Append(BuildInfoItem(GetParacliniqueLabel("date", locale), displayDate));
        sb.Append(BuildInfoItem(GetParacliniqueLabel("time", locale), heure));
        sb.Append("</div></section>");

        if (bilanTypes.Count == 0)
        {
            sb.Append($"<p class=\"plain-line\">{EscapeHtml(locale.LanguageCode switch
            {
                "ar" => "\u0644\u0627 \u062A\u0648\u062C\u062F \u062A\u062D\u0627\u0644\u064A\u0644 \u0645\u062D\u062F\u062F\u0629",
                "en" => "No blood test selected",
                _ => "Aucun bilan sanguin sÃƒÂ©lectionnÃƒÂ©",
            })}</p>");
        }
        else
        {
            sb.Append("<section class=\"bilan-grid\">");
            foreach (var bilanType in bilanTypes)
            {
                sb.Append("<article class=\"bilan-card\">");
                sb.Append($"<h3 class=\"bilan-card-title\">{EscapeHtml(bilanType.Name)}</h3>");
                sb.Append("<ul class=\"bilan-list\">");
                foreach (var checkbox in bilanType.Checkboxes)
                {
                    sb.Append("<li>");
                    sb.Append(EscapeHtml(bilanType.ShowCheckboxMarkers ? $"{(checkbox.Checked ? "Ã¢â€“Â " : "Ã¢â€“Â¡")} {checkbox.Label}" : checkbox.Label));
                    sb.Append("</li>");
                }
                sb.Append("</ul>");
                sb.Append("</article>");
            }
            sb.Append("</section>");
        }

        if (!string.IsNullOrWhiteSpace(info))
        {
            sb.Append(BuildAdditionalInformationHtml(locale, info));
        }

        return sb.ToString();
    }

    private static string BuildClinicDetailsHtml(PrintClinicInfo? clinic, PrintLocale locale)
    {
        if (clinic is null)
        {
            return string.Empty;
        }

        var clinicDetailsLabel = EscapeHtml(GetParacliniqueLabel("clinicDetails", locale));
        var nameLabel = EscapeHtml(GetParacliniqueLabel("name", locale));
        var phoneLabel = EscapeHtml(GetParacliniqueLabel("phone", locale));
        var addressLabel = EscapeHtml(GetParacliniqueLabel("address", locale));
        var mapsLabel = EscapeHtml(GetParacliniqueLabel("maps", locale));
        var qrCode = BuildClinicQrCode(clinic.GoogleMapsLink);
        var qrDataUri = BuildPngDataUri(qrCode);
        var sb = new StringBuilder();

        sb.Append("<section class=\"clinic-card\">");
        sb.Append("<div class=\"clinic-details\">");
        sb.Append("<h3 class=\"clinic-title\">");
        sb.Append(clinicDetailsLabel);
        sb.Append("</h3>");
        sb.Append("<p class=\"plain-line\"><span class=\"label\">");
        sb.Append(nameLabel);
        sb.Append(":</span> ");
        sb.Append(EscapeHtml(DefaultIfEmpty(clinic.Name, "-")));
        sb.Append("</p>");
        sb.Append("<p class=\"plain-line\"><span class=\"label\">");
        sb.Append(phoneLabel);
        sb.Append(":</span> ");
        sb.Append(EscapeHtml(DefaultIfEmpty(clinic.PhoneNumber, "-")));
        sb.Append("</p>");
        sb.Append("<p class=\"plain-line\"><span class=\"label\">");
        sb.Append(addressLabel);
        sb.Append(":</span> ");
        sb.Append(EscapeHtml(DefaultIfEmpty(clinic.Address, "-")));
        sb.Append("</p>");

        if (!string.IsNullOrWhiteSpace(clinic.GoogleMapsLink))
        {
            sb.Append("<p class=\"plain-line\"><span class=\"label\">");
            sb.Append(mapsLabel);
            sb.Append(":</span> ");
            sb.Append(EscapeHtml(clinic.GoogleMapsLink));
            sb.Append("</p>");
        }

        sb.Append("</div>");

        if (!string.IsNullOrWhiteSpace(qrDataUri))
        {
            sb.Append($"<img class=\"qr-image\" src=\"{qrDataUri}\" alt=\"Clinic QR code\" />");
        }

        sb.Append("</section>");
        return sb.ToString();
    }

    private static string BuildAdditionalInformationHtml(PrintLocale locale, string info)
    {
        return $$"""
<section class="additional-box">
  <h3 class="additional-title">{{EscapeHtml(locale.AdditionalInformationLabel)}}</h3>
  <p class="plain-line">{{Nl2Br(info)}}</p>
</section>
""";
    }

    private static string BuildInfoItem(string label, string value)
    {
        return $"<p class=\"plain-line\"><span class=\"label\">{EscapeHtml(label)}:</span> {EscapeHtml(value)}</p>";
    }

    private static string BuildPngDataUri(byte[]? bytes)
    {
        return bytes is null || bytes.Length == 0
            ? string.Empty
            : $"data:image/png;base64,{Convert.ToBase64String(bytes)}";
    }
}
