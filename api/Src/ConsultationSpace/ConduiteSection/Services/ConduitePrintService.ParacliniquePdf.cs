using System.Globalization;
using System.IO;
using System.Text;
using System.Text.Json;
using QuestPDF.Drawing;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using QRCoder;

namespace api.Src.ConsultationSpace.ConduiteSection.Services;

public partial class ConduitePrintService
{
    static ConduitePrintService()
    {
        QuestPDF.Settings.License = LicenseType.Community;
        RegisterQuestPdfFonts();
    }

    private static void RegisterQuestPdfFonts()
    {
        var fontCandidates = new[]
        {
            @"C:\Windows\Fonts\arial.ttf",
            @"C:\Windows\Fonts\arialbd.ttf",
            @"C:\Windows\Fonts\tahoma.ttf",
            @"C:\Windows\Fonts\segoeui.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/noto/NotoNaskhArabic-Regular.ttf",
            "/usr/share/fonts/truetype/noto/NotoSansArabic-Regular.ttf",
        };

        foreach (var fontPath in fontCandidates)
        {
            try
            {
                if (!File.Exists(fontPath))
                {
                    continue;
                }

                using var fontStream = File.OpenRead(fontPath);
                FontManager.RegisterFont(fontStream);
            }
            catch
            {
                // Continue with other candidates.
            }
        }
    }

    public async Task<byte[]> GenerateParacliniquePdf(
        Guid consultationId,
        Guid cabinetIdentityId,
        IReadOnlyCollection<string>? sections = null,
        string? language = null)
    {
        var context = await LoadPrintContext(consultationId, cabinetIdentityId);
        var locale = ResolvePrintLocale(language, context.DoctorLanguagePreference);

        var requestedSections = ResolveParacliniqueRequestedSections(sections);
        var pages = BuildParacliniquePdfPages(context, locale, requestedSections);

        if (pages.Count == 0)
        {
            throw new InvalidOperationException(GetNoParacliniqueDataMessage(locale));
        }

        var document = Document.Create(container =>
        {
            foreach (var pageData in pages)
            {
                container.Page(page =>
                {
                    ComposeParacliniquePdfPage(page, context, locale, pageData);
                });
            }
        });

        return document.GeneratePdf();
    }

    private static IReadOnlyList<ParacliniquePrintSectionKind> ResolveParacliniqueRequestedSections(
        IReadOnlyCollection<string>? sections)
    {
        if (sections is null || sections.Count == 0)
        {
            return ParacliniquePrintSectionOrder;
        }

        var result = new List<ParacliniquePrintSectionKind>();

        foreach (var raw in sections)
        {
            var normalized = ConduiteActionKeys.NormalizeActionKey(raw);
            var section = normalized switch
            {
                "chirurgie" => ParacliniquePrintSectionKind.Chirurgie,
                "imagerie" => ParacliniquePrintSectionKind.Imagerie,
                "bilan_sanguin" => ParacliniquePrintSectionKind.BilanSanguin,
                _ => (ParacliniquePrintSectionKind?)null,
            };

            if (section is null || result.Contains(section.Value))
            {
                continue;
            }

            result.Add(section.Value);
        }

        return result.Count > 0 ? result : ParacliniquePrintSectionOrder;
    }

    private static List<ParacliniquePdfPageData> BuildParacliniquePdfPages(
        PrintContext context,
        PrintLocale locale,
        IReadOnlyList<ParacliniquePrintSectionKind> requestedSections)
    {
        var pages = new List<ParacliniquePdfPageData>();

        foreach (var section in requestedSections)
        {
            if (!TryGetParacliniquePayload(context, section, out var payload))
            {
                continue;
            }

            if (!IsParacliniquePayloadMeaningful(section, payload))
            {
                continue;
            }

            pages.Add(new ParacliniquePdfPageData
            {
                Section = section,
                Title = GetParacliniquePageTitle(section, locale),
                Payload = payload,
            });
        }

        return pages;
    }

    private static bool TryGetParacliniquePayload(
        PrintContext context,
        ParacliniquePrintSectionKind section,
        out Dictionary<string, JsonElement> payload)
    {
        var actionKey = section switch
        {
            ParacliniquePrintSectionKind.Chirurgie => ConduiteActionKeys.ParacliniqueChirurgie,
            ParacliniquePrintSectionKind.Imagerie => ConduiteActionKeys.ParacliniqueImagerie,
            ParacliniquePrintSectionKind.BilanSanguin => ConduiteActionKeys.ParacliniqueBilanSanguin,
            _ => string.Empty,
        };

        if (!context.ActionsByKey.TryGetValue(actionKey, out var action))
        {
            payload = [];
            return false;
        }

        payload = action.Payload;
        return true;
    }

    private static bool IsParacliniquePayloadMeaningful(
        ParacliniquePrintSectionKind section,
        Dictionary<string, JsonElement> payload)
    {
        var (date, time) = ResolveParacliniqueDateAndTime(payload);
        var hasDateTime = date != "-" || time != "-";

        return section switch
        {
            ParacliniquePrintSectionKind.Chirurgie =>
                ResolveParacliniqueActe(payload, isBilan: false) != "-" ||
                hasDateTime ||
                !string.IsNullOrWhiteSpace(ReadString(payload, "clinique")) ||
                !string.IsNullOrWhiteSpace(ReadString(payload, "forfait")) ||
                !string.IsNullOrWhiteSpace(ReadString(payload, "operateur")) ||
                !string.IsNullOrWhiteSpace(ReadString(payload, "informationAdditionnel")),

            ParacliniquePrintSectionKind.Imagerie =>
                ResolveParacliniqueActe(payload, isBilan: false) != "-" ||
                hasDateTime ||
                !string.IsNullOrWhiteSpace(ReadString(payload, "clinique")) ||
                !string.IsNullOrWhiteSpace(ReadString(payload, "forfait")) ||
                !string.IsNullOrWhiteSpace(ReadString(payload, "informationAdditionnel")),

            ParacliniquePrintSectionKind.BilanSanguin =>
                ReadBilanPdfTypeItems(payload).Count > 0 ||
                hasDateTime ||
                !string.IsNullOrWhiteSpace(ReadString(payload, "informationAdditionnel")),

            _ => false,
        };
    }

    private static string GetParacliniquePageTitle(ParacliniquePrintSectionKind section, PrintLocale locale)
    {
        return (section, locale.LanguageCode) switch
        {
            (ParacliniquePrintSectionKind.Chirurgie, "ar") => "Ø¬Ø±Ø§Ø­Ø©",
            (ParacliniquePrintSectionKind.Imagerie, "ar") => "ØªØµÙˆÙŠØ± Ø·Ø¨ÙŠ",
            (ParacliniquePrintSectionKind.BilanSanguin, "ar") => "ØªØ­Ø§Ù„ÙŠÙ„ Ø¯Ù…ÙˆÙŠØ©",

            (ParacliniquePrintSectionKind.Chirurgie, "en") => "Surgery",
            (ParacliniquePrintSectionKind.Imagerie, "en") => "Imagerie",
            (ParacliniquePrintSectionKind.BilanSanguin, "en") => "Blood tests",

            (ParacliniquePrintSectionKind.Chirurgie, _) => "Chirurgie",
            (ParacliniquePrintSectionKind.Imagerie, _) => "Imagerie",
            (ParacliniquePrintSectionKind.BilanSanguin, _) => "Bilan sanguin",
            _ => locale.ParacliniqueTitle,
        };
    }

    private static string GetNoParacliniqueDataMessage(PrintLocale locale)
    {
        return locale.LanguageCode switch
        {
            "ar" => "Ù„Ø§ ØªÙˆØ¬Ø¯ Ø¨ÙŠØ§Ù†Ø§Øª ÙØ­ÙˆØµØ§Øª Ù…ØªÙ…Ù…Ø© Ù‚Ø§Ø¨Ù„Ø© Ù„Ù„Ø·Ø¨Ø§Ø¹Ø©.",
            "en" => "No paraclinical data available for printing.",
            _ => "Aucune donnée paraclinique disponible pour impression.",
        };
    }

    private static void ComposeParacliniquePdfPage(
        PageDescriptor page,
        PrintContext context,
        PrintLocale locale,
        ParacliniquePdfPageData pageData)
    {
        page.Size(PageSizes.A4);
        page.Margin(20);
        page.PageColor(Colors.White);
        page.DefaultTextStyle(text => text
            .FontFamily("Arial", "Tahoma", "Segoe UI", "Noto Naskh Arabic", "Noto Sans Arabic", "DejaVu Sans")
            .FontSize(11));

        page.Header().Element(container => ComposeParacliniquePdfHeader(container, context, locale));
        page.Content().PaddingTop(10).Element(container => ComposeParacliniquePdfContent(container, context, locale, pageData));
        page.Footer().PaddingTop(8).Element(container => ComposeParacliniquePdfFooter(container, context, locale));
    }

    private static void ComposeParacliniquePdfHeader(
        IContainer container,
        PrintContext context,
        PrintLocale locale)
    {
        if (!context.Personalization.ShowHeader)
        {
            container.Column(_ => { });
            return;
        }

        var doctorDisplayName = BuildPersonalizedDoctorLatinName(context, locale);
        var doctorArabicDisplayName = BuildPersonalizedDoctorArabicName(context, locale);
        var cnamValue = BuildPersonalizedCnamValue(context);
        var professionLabel = locale.LanguageCode == "ar"
            ? "\u0637\u0628\u064A\u0628 \u0639\u0627\u0645"
            : "Médecin généraliste";

        container.Column(column =>
        {
            column.Spacing(5);

            column.Item().Row(row =>
            {
                row.Spacing(10);

                row.RelativeItem(5).Column(left =>
                {
                    left.Item().Text(doctorDisplayName).SemiBold();
                    left.Item().Text(professionLabel).FontSize(10);
                    left.Item().PaddingTop(2).LineHorizontal(1).LineColor("#0F766E");
                });

                row.AutoItem().PaddingHorizontal(6).Column(center =>
                {
                    if (context.Personalization.ShowCodeCnam)
                    {
                        center.Item().AlignCenter().Text($"{locale.CnamLabel}: {cnamValue}").SemiBold();
                    }
                });

                row.RelativeItem(5).Column(right =>
                {
                    if (!string.IsNullOrWhiteSpace(doctorArabicDisplayName))
                    {
                        right.Item()
                            .ContentFromRightToLeft()
                            .AlignRight()
                            .Text(text =>
                        {
                            text.DefaultTextStyle(style =>
                                style
                                    .FontFamily("Tahoma", "Segoe UI", "Noto Naskh Arabic", "Noto Sans Arabic", "DejaVu Sans")
                                    .FontSize(11)
                                    .SemiBold());
                            text.Span("\u200F" + doctorArabicDisplayName);
                        });
                        // Spacer that matches the profession-label row height on the left side.
                        right.Item()
                            .ContentFromRightToLeft()
                            .AlignRight()
                            .Text(text =>
                            {
                                text.DefaultTextStyle(style =>
                                    style
                                        .FontFamily("Tahoma", "Segoe UI", "Noto Naskh Arabic", "Noto Sans Arabic", "DejaVu Sans")
                                        .FontSize(10));
                                text.Span("\u200F ");
                            });
                        right.Item().PaddingTop(2).LineHorizontal(1).LineColor("#0F766E");
                    }
                    else
                    {
                        // Keep the same 3-item structure even when Arabic is hidden,
                        // so the accent line stays aligned with the left column.
                        right.Item().MinHeight(16); // matches approximate name-text height
                        right.Item().MinHeight(14); // matches approximate profession-text height
                        right.Item().PaddingTop(2).LineHorizontal(1).LineColor("#0F766E");
                    }
                });
            });

            column.Item().Row(row =>
            {
                row.RelativeItem();
                row.AutoItem().Text(BrandName).SemiBold().FontSize(15).FontColor("#6B7280");
                row.RelativeItem();
            });
            column.Item().LineHorizontal(1).LineColor("#a9b1bd");
        });
    }
    private static void ComposeParacliniquePdfContent(
        IContainer container,
        PrintContext context,
        PrintLocale locale,
        ParacliniquePdfPageData pageData)
    {
        var patientName = BuildPatientDisplayName(context);
        var age = CalculateAge(context.PatientDateOfBirth);

        container.Column(column =>
        {
            column.Spacing(10);

            column.Item().Row(row =>
            {
                row.RelativeItem();
                row.AutoItem().Text(pageData.Title).SemiBold().FontSize(16).FontColor("#0F766E");
                row.RelativeItem();
            });

            column.Item().Border(1).BorderColor("#D1D5DB").Padding(8).Row(row =>
            {
                row.RelativeItem().Text($"{locale.PatientLabel}: {patientName}").SemiBold();
                row.RelativeItem().AlignRight().Text($"{locale.AgeLabel}: {age} | {locale.RecordLabel}: {context.PatientDossierNumber}");
            });

            column.Item().Element(sectionContainer =>
            {
                switch (pageData.Section)
                {
                    case ParacliniquePrintSectionKind.Chirurgie:
                        ComposeParacliniqueChirurgieContent(sectionContainer, context, pageData.Payload, locale);
                        break;
                    case ParacliniquePrintSectionKind.Imagerie:
                        ComposeParacliniqueImagerieContent(sectionContainer, context, pageData.Payload, locale);
                        break;
                    case ParacliniquePrintSectionKind.BilanSanguin:
                        ComposeParacliniqueBilanContent(sectionContainer, context, pageData.Payload, locale);
                        break;
                }
            });
        });
    }

    private static void ComposeParacliniqueChirurgieContent(
        IContainer container,
        PrintContext context,
        Dictionary<string, JsonElement> payload,
        PrintLocale locale)
    {
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
        var clinicQrCode = BuildClinicQrCode(matchedClinic?.GoogleMapsLink ?? string.Empty);

        container.Column(column =>
        {
            column.Spacing(8);

            column.Item().Text(GetPatientSalutationLine(context, locale)).SemiBold();

            column.Item().Border(1).BorderColor("#D1D5DB").Padding(8).Column(box =>
            {
                box.Spacing(4);
                box.Item().Row(row =>
                {
                    row.RelativeItem().Text($"{GetParacliniqueLabel("date", locale)} : {date}").SemiBold().FontSize(10);
                    row.RelativeItem().AlignRight().Text($"{GetParacliniqueLabel("forfait", locale)} : {forfait}").SemiBold().FontSize(10);
                });

                box.Item().Row(row =>
                {
                    row.RelativeItem().Text($"{GetParacliniqueLabel("operateur", locale)} : {operateur}").SemiBold().FontSize(10);
                    row.RelativeItem().AlignRight().Text($"{GetParacliniqueLabel("time", locale)} : {heure}").SemiBold().FontSize(10);
                });
            });

            column.Item().Text($"{GetParacliniqueLabel("acte", locale)} :").SemiBold();
            if (types.Count == 0)
            {
                column.Item().PaddingLeft(12).Text("-");
            }
            else
            {
                foreach (var type in types)
                {
                    column.Item().PaddingLeft(12).Text($"- {type}");
                }
            }

            column.Item().Text($"{GetParacliniqueLabel("clinique", locale)} : {clinique}");

            if (matchedClinic is not null)
            {
                column.Item().Border(1).BorderColor("#D1D5DB").Padding(8).Row(row =>
                {
                    row.RelativeItem().Column(details =>
                    {
                        details.Spacing(4);
                        details.Item().Text(GetParacliniqueLabel("clinicDetails", locale)).SemiBold().FontColor("#0F766E");
                        details.Item().Text($"{GetParacliniqueLabel("name", locale)} : {DefaultIfEmpty(matchedClinic.Name, "-")}");
                        details.Item().Text($"{GetParacliniqueLabel("phone", locale)} : {DefaultIfEmpty(matchedClinic.PhoneNumber, "-")}");
                        details.Item().Text($"{GetParacliniqueLabel("address", locale)} : {DefaultIfEmpty(matchedClinic.Address, "-")}");

                        if (!string.IsNullOrWhiteSpace(matchedClinic.GoogleMapsLink))
                        {
                            details.Item().Text($"{GetParacliniqueLabel("maps", locale)} : {matchedClinic.GoogleMapsLink}");
                        }
                    });

                    if (clinicQrCode is not null)
                    {
                        row.ConstantItem(96).AlignCenter().AlignMiddle().Height(96).Image(clinicQrCode);
                    }
                });
            }

            if (!string.IsNullOrWhiteSpace(info))
            {
                column.Item().Border(1).BorderColor("#E5E7EB").Padding(8).Column(infoColumn =>
                {
                    infoColumn.Item().Text(locale.AdditionalInformationLabel).SemiBold();
                    infoColumn.Item().Text(info);
                });
            }
        });
    }

    private static void ComposeParacliniqueImagerieContent(
        IContainer container,
        PrintContext context,
        Dictionary<string, JsonElement> payload,
        PrintLocale locale)
    {
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
        var clinicQrCode = BuildClinicQrCode(matchedClinic?.GoogleMapsLink ?? string.Empty);

        container.Column(column =>
        {
            column.Spacing(8);

            column.Item().Text(GetPatientSalutationLine(context, locale)).SemiBold();

            column.Item().Border(1).BorderColor("#D1D5DB").Padding(8).Column(box =>
            {
                box.Spacing(4);
                box.Item().Text($"{GetParacliniqueLabel("date", locale)} : {date}").SemiBold().FontSize(10);
                box.Item().Text($"{GetParacliniqueLabel("time", locale)} : {heure}").SemiBold().FontSize(10);
                box.Item().Text($"{GetParacliniqueLabel("clinique", locale)} : {clinique}").FontSize(10);
                box.Item().Text($"{GetParacliniqueLabel("forfait", locale)} : {forfait}").FontSize(10);
            });

            column.Item().Text(GetParacliniqueLabel("examTypes", locale)).SemiBold();
            if (types.Count == 0)
            {
                column.Item().Text(GetParacliniquePlaceholder());
            }
            else
            {
                foreach (var type in types)
                {
                    column.Item().Text($"- {type}");
                }
            }

            if (matchedClinic is not null)
            {
                column.Item().Border(1).BorderColor("#D1D5DB").Padding(8).Row(row =>
                {
                    row.RelativeItem().Column(details =>
                    {
                        details.Spacing(4);
                        details.Item().Text(GetParacliniqueLabel("clinicDetails", locale)).SemiBold().FontColor("#0F766E");
                        details.Item().Text($"{GetParacliniqueLabel("name", locale)} : {DefaultIfEmpty(matchedClinic.Name, "-")}");
                        details.Item().Text($"{GetParacliniqueLabel("phone", locale)} : {DefaultIfEmpty(matchedClinic.PhoneNumber, "-")}");
                        details.Item().Text($"{GetParacliniqueLabel("address", locale)} : {DefaultIfEmpty(matchedClinic.Address, "-")}");

                        if (!string.IsNullOrWhiteSpace(matchedClinic.GoogleMapsLink))
                        {
                            details.Item().Text($"{GetParacliniqueLabel("maps", locale)} : {matchedClinic.GoogleMapsLink}");
                        }
                    });

                    if (clinicQrCode is not null)
                    {
                        row.ConstantItem(96).AlignCenter().AlignMiddle().Height(96).Image(clinicQrCode);
                    }
                });
            }

            if (!string.IsNullOrWhiteSpace(info))
            {
                column.Item().Border(1).BorderColor("#E5E7EB").Padding(8).Column(infoColumn =>
                {
                    infoColumn.Item().Text(locale.AdditionalInformationLabel).SemiBold();
                    infoColumn.Item().Text(info);
                });
            }
        });
    }

    private static void ComposeParacliniqueBilanContent(
        IContainer container,
        PrintContext context,
        Dictionary<string, JsonElement> payload,
        PrintLocale locale)
    {
        var (date, heure) = ResolveParacliniqueDateAndTime(payload);
        var info = ReadString(payload, "informationAdditionnel");
        var bilanTypes = ReadBilanPdfTypeItems(payload);
        var displayDate = date == "-" ? FormatDate(context.ConsultationDate, locale, includeTime: false) : date;

        container.Column(column =>
        {
            column.Spacing(8);

            column.Item().Text(text =>
            {
                text.Span($"{GetParacliniqueLabel("doctor", locale)} : ").SemiBold();
                text.Span(BuildDoctorDisplayName(context, locale));
                text.Span("   ");
                text.Span($"{locale.PatientLabel} : ").SemiBold();
                text.Span(BuildPatientDisplayName(context));
                text.Span("   ");
                text.Span($"{GetParacliniqueLabel("date", locale)} : ").SemiBold();
                text.Span(displayDate);
            });

            column.Item().Border(1).BorderColor("#D1D5DB").Padding(8).Column(box =>
            {
                box.Spacing(4);
                box.Item().Text($"{GetParacliniqueLabel("date", locale)} : {displayDate}").SemiBold().FontSize(10);
                box.Item().Text($"{GetParacliniqueLabel("time", locale)} : {heure}").SemiBold().FontSize(10);
            });

            if (bilanTypes.Count == 0)
            {
                column.Item().Text(locale.LanguageCode switch
                {
                    "ar" => "Ù„Ø§ ØªÙˆØ¬Ø¯ ØªØ­Ø§Ù„ÙŠÙ„ Ù…Ø­Ø¯Ø¯Ø©",
                    "en" => "No blood test selected",
                    _ => "Aucun bilan sanguin sélectionné",
                });
            }
            else
            {
                foreach (var rowItems in bilanTypes.Chunk(3))
                {
                    column.Item().Row(row =>
                    {
                        foreach (var bilanType in rowItems)
                        {
                            row.RelativeItem().Border(1).BorderColor("#E5E7EB").Padding(8).Column(typeColumn =>
                            {
                                typeColumn.Spacing(4);
                                typeColumn.Item().Text(bilanType.Name).SemiBold().FontColor("#0F766E");

                                foreach (var checkbox in bilanType.Checkboxes)
                                {
                                    var content = bilanType.ShowCheckboxMarkers
                                        ? $"{(checkbox.Checked ? "■" : "□")} {checkbox.Label}"
                                        : checkbox.Label;
                                    typeColumn.Item().Text(content).FontSize(10);
                                }
                            });
                        }

                        for (var index = rowItems.Length; index < 3; index += 1)
                        {
                            row.RelativeItem();
                        }
                    });
                }
            }

            if (!string.IsNullOrWhiteSpace(info))
            {
                column.Item().Border(1).BorderColor("#E5E7EB").Padding(8).Column(infoColumn =>
                {
                    infoColumn.Item().Text(locale.AdditionalInformationLabel).SemiBold();
                    infoColumn.Item().Text(info);
                });
            }
        });
    }

    private static string GetPatientSalutationLine(PrintContext context, PrintLocale locale)
    {
        var patientName = BuildPatientDisplayName(context);
        return locale.LanguageCode switch
        {
            "ar" => $"\u0627\u0644\u0633\u064a\u062f/\u0627\u0644\u0633\u064a\u062f\u0629 {patientName}",
            "en" => $"Patient: {patientName}",
            _ => $"Madame/Monsieur {patientName}",
        };
    }

    private static string GetParacliniqueLabel(string key, PrintLocale locale)
    {
        return (key, locale.LanguageCode) switch
        {
            ("acte", "ar") => "\u0627\u0644\u0625\u062c\u0631\u0627\u0621",
            ("oeil", "ar") => "\u0627\u0644\u0639\u064a\u0646",
            ("clinique", "ar") => "\u0627\u0644\u0645\u0635\u062d\u0629",
            ("forfait", "ar") => "\u0627\u0644\u0628\u0627\u0642\u0629",
            ("operateur", "ar") => "\u0627\u0644\u062c\u0631\u0627\u062d",
            ("examTypes", "ar") => "\u0623\u0646\u0648\u0627\u0639 \u0627\u0644\u0641\u062d\u0648\u0635\u0627\u062a",
            ("clinicDetails", "ar") => "\u062a\u0641\u0627\u0635\u064a\u0644 \u0627\u0644\u0645\u0635\u062d\u0629",
            ("name", "ar") => "\u0627\u0644\u0627\u0633\u0645",
            ("phone", "ar") => "\u0627\u0644\u0647\u0627\u062a\u0641",
            ("address", "ar") => "\u0627\u0644\u0639\u0646\u0648\u0627\u0646",
            ("maps", "ar") => "Google Maps",
            ("doctor", "ar") => "\u0627\u0644\u0637\u0628\u064a\u0628",
            ("date", "ar") => "\u0627\u0644\u062a\u0627\u0631\u064a\u062e",
            ("time", "ar") => "\u0627\u0644\u0648\u0642\u062a",

            ("acte", "en") => "Procedure",
            ("oeil", "en") => "Eye",
            ("clinique", "en") => "Clinic",
            ("forfait", "en") => "Package",
            ("operateur", "en") => "Surgeon",
            ("examTypes", "en") => "Examination types",
            ("clinicDetails", "en") => "Clinic details",
            ("name", "en") => "Name",
            ("phone", "en") => "Phone",
            ("address", "en") => "Address",
            ("maps", "en") => "Google Maps",
            ("doctor", "en") => "Doctor",
            ("date", "en") => "Date",
            ("time", "en") => "Time",

            ("acte", _) => "Acte",
            ("oeil", _) => "Œil",
            ("clinique", _) => "Clinique",
            ("forfait", _) => "Forfait",
            ("operateur", _) => "Opérateur",
            ("examTypes", _) => "Types d'examen",
            ("clinicDetails", _) => "Détails de la clinique",
            ("name", _) => "Nom",
            ("phone", _) => "Téléphone",
            ("address", _) => "Adresse",
            ("maps", _) => "Google Maps",
            ("doctor", _) => "Médecin",
            ("date", _) => "Date",
            ("time", _) => "Heure",
            _ => key,
        };
    }

    private static string GetParacliniquePlaceholder()
    {
        return "........................................................";
    }

    private static PrintClinicInfo? ResolveDoctorClinic(PrintContext context, string cliniqueName)
    {
        var normalizedName = NormalizeParacliniqueClinicName(cliniqueName);
        if (string.IsNullOrWhiteSpace(normalizedName))
        {
            return null;
        }

        return context.DoctorClinics.FirstOrDefault(clinic =>
            NormalizeParacliniqueClinicName(clinic.Name) == normalizedName);
    }

    private static string NormalizeParacliniqueClinicName(string value)
    {
        return value.Trim().ToLowerInvariant();
    }

    private static byte[]? BuildClinicQrCode(string value)
    {
        var normalizedValue = value.Trim();
        if (string.IsNullOrWhiteSpace(normalizedValue))
        {
            return null;
        }

        using var qrGenerator = new QRCodeGenerator();
        using var qrCodeData = qrGenerator.CreateQrCode(normalizedValue, QRCodeGenerator.ECCLevel.Q);
        var qrCode = new PngByteQRCode(qrCodeData);
        return qrCode.GetGraphic(10);
    }

    private static void ComposeParacliniquePdfFooter(
        IContainer container,
        PrintContext context,
        PrintLocale locale)
    {
        if (!context.Personalization.ShowFooter)
        {
            container.Column(_ => { });
            return;
        }

        var addressLine = BuildPersonalizedFooterAddressLine(context);
        var contacts = BuildPersonalizedFooterContacts(context);

        if (string.IsNullOrWhiteSpace(addressLine) && contacts.Count == 0)
        {
            container.Column(_ => { });
            return;
        }

        container.Column(column =>
        {
            column.Spacing(4);
            column.Item().LineHorizontal(1).LineColor("#D1D5DB");

            if (!string.IsNullOrWhiteSpace(addressLine))
            {
                column.Item().Text(addressLine).AlignCenter().FontSize(9).FontColor("#4B5563");
            }

            if (contacts.Count > 0)
            {
                var contactLine = BuildParacliniqueFooterContactLine(contacts, locale);
                column.Item().Text(contactLine).AlignCenter().FontSize(9).FontColor("#4B5563");
            }
        });
    }

    private static string BuildParacliniqueFooterContactLine(
        IReadOnlyList<PrintFooterContactItem> contacts,
        PrintLocale locale)
    {
        var sb = new StringBuilder();

        for (var index = 0; index < contacts.Count; index += 1)
        {
            var contact = contacts[index];
            var segment = contact.Kind switch
            {
                PrintFooterContactKind.Landline => $"â˜Ž {contact.Value}",
                PrintFooterContactKind.Mobile => $"ðŸ“± {contact.Value}",
                PrintFooterContactKind.Email => $"{locale.EmailLabel}: {contact.Value}",
                _ => contact.Value,
            };

            if (sb.Length > 0)
            {
                sb.Append("  |  ");
            }

            sb.Append(segment);
        }

        return sb.ToString();
    }

    private static List<BilanPdfTypeItem> ReadBilanPdfTypeItems(Dictionary<string, JsonElement> payload)
    {
        var result = new List<BilanPdfTypeItem>();

        var selectedBilanTypes = ReadArray(payload, "selectedBilanTypes");
        foreach (var selectedType in selectedBilanTypes)
        {
            if (selectedType.ValueKind != JsonValueKind.Object)
            {
                continue;
            }

            var name = ReadString(selectedType, "name");
            var key = ReadString(selectedType, "key");
            var displayName = string.IsNullOrWhiteSpace(name) ? key : name;
            if (string.IsNullOrWhiteSpace(displayName))
            {
                continue;
            }

            var checkboxValuesElement = ReadObject(selectedType, "checkboxValues");
            var checkboxValues = new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase);
            if (checkboxValuesElement.ValueKind == JsonValueKind.Object)
            {
                foreach (var property in checkboxValuesElement.EnumerateObject())
                {
                    checkboxValues[property.Name] = ReadBoolean(property.Value);
                }
            }

            var checkboxes = new List<BilanPdfCheckboxItem>();
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
                    var definitionLabel = ReadString(definition, "label");
                    if (string.IsNullOrWhiteSpace(definitionKey) && string.IsNullOrWhiteSpace(definitionLabel))
                    {
                        continue;
                    }

                    var label = string.IsNullOrWhiteSpace(definitionLabel) ? definitionKey : definitionLabel;
                    var checkedValue = !string.IsNullOrWhiteSpace(definitionKey)
                        && checkboxValues.TryGetValue(definitionKey, out var isChecked)
                        && isChecked;

                    checkboxes.Add(new BilanPdfCheckboxItem
                    {
                        Label = label,
                        Checked = checkedValue,
                    });
                }
            }
            else
            {
                foreach (var entry in checkboxValues)
                {
                    checkboxes.Add(new BilanPdfCheckboxItem
                    {
                        Label = entry.Key,
                        Checked = entry.Value,
                    });
                }
            }

            if (IsAllBilanTypeKey(key))
            {
                checkboxes = checkboxes.Where(item => item.Checked).ToList();
            }

            if (checkboxes.Count == 0 || !checkboxes.Any(item => item.Checked))
            {
                continue;
            }

            result.Add(new BilanPdfTypeItem
            {
                Name = displayName,
                Checkboxes = checkboxes,
                ShowCheckboxMarkers = !IsAllBilanTypeKey(key),
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

            var checkboxes = new List<BilanPdfCheckboxItem>();
            foreach (var checkboxEntry in payloadEntry.Value.EnumerateObject())
            {
                if (ReadBoolean(checkboxEntry.Value))
                {
                    checkboxes.Add(new BilanPdfCheckboxItem
                    {
                        Label = checkboxEntry.Name,
                        Checked = true,
                    });
                }
            }

            if (checkboxes.Count == 0)
            {
                continue;
            }

            result.Add(new BilanPdfTypeItem
            {
                Name = payloadEntry.Key,
                Checkboxes = checkboxes,
                ShowCheckboxMarkers = true,
            });
        }

        return result;
    }

    private static bool IsAllBilanTypeKey(string key)
    {
        return string.Equals(key, "bilanSanguin", StringComparison.OrdinalIgnoreCase);
    }

    private static readonly IReadOnlyList<ParacliniquePrintSectionKind> ParacliniquePrintSectionOrder =
    [
        ParacliniquePrintSectionKind.Chirurgie,
        ParacliniquePrintSectionKind.Imagerie,
        ParacliniquePrintSectionKind.BilanSanguin,
    ];

    private enum ParacliniquePrintSectionKind
    {
        Chirurgie,
        Imagerie,
        BilanSanguin,
    }

    private sealed class ParacliniquePdfPageData
    {
        public ParacliniquePrintSectionKind Section { get; init; }
        public string Title { get; init; } = string.Empty;
        public Dictionary<string, JsonElement> Payload { get; init; } = [];
    }

    private sealed class BilanPdfTypeItem
    {
        public string Name { get; init; } = string.Empty;
        public IReadOnlyList<BilanPdfCheckboxItem> Checkboxes { get; init; } = [];
        public bool ShowCheckboxMarkers { get; init; } = true;
    }

    private sealed class BilanPdfCheckboxItem
    {
        public string Label { get; init; } = string.Empty;
        public bool Checked { get; init; }
    }
}



