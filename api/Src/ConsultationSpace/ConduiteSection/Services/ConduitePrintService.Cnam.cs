using System.Globalization;
using System.Text.Json;
using api.Src.ConsultationSpace.ConduiteSection.Dtos.Responses;

namespace api.Src.ConsultationSpace.ConduiteSection.Services;

public partial class ConduitePrintService
{
    public async Task<CnamPrintDataResponse> GetCnamPrintData(
        Guid consultationId,
        Guid cabinetIdentityId)
    {
        var context = await LoadPrintContext(consultationId, cabinetIdentityId);
        context.ActionsByKey.TryGetValue(ConduiteActionKeys.Cnam, out var action);
        var actionPayload = action?.Payload ?? new Dictionary<string, JsonElement>(StringComparer.Ordinal);

        var selectedFormType = NormalizeCnamFormType(ReadString(actionPayload, "selectedFormType"));
        var sourcePayload = ResolveCnamFormPayload(actionPayload, selectedFormType);

        return new CnamPrintDataResponse
        {
            ConsultationId = consultationId,
            SelectedFormType = selectedFormType,
            TemplateFileName = BuildCnamTemplateFileName(selectedFormType),
            FileName = BuildCnamFileName(selectedFormType, context),
            CodeConventionnel = ReadString(sourcePayload, "codeConventionnel"),
            Ap1MedicationLines = ReadAp1MedicationLines(sourcePayload),
            Code = ReadString(sourcePayload, "code"),
            Oeil = ReadString(sourcePayload, "oeil"),
            Clinique = ReadString(sourcePayload, "clinique"),
            Diagnostic = ReadString(sourcePayload, "diagnostic"),
            Observation = ReadString(sourcePayload, "observation"),
            Therapeutique = ReadString(sourcePayload, "therapeutique"),
            NatureExamen = ReadString(sourcePayload, "natureExamen"),
            DateExamen = ReadString(sourcePayload, "dateExamen"),
            DonneesCliniquesParacliniques = ReadString(sourcePayload, "donneesCliniquesParacliniques"),
            Diagnostics = ReadString(sourcePayload, "diagnostics"),
            PathologieOrigine = ReadString(sourcePayload, "pathologieOrigine"),
            Traitement = ReadString(sourcePayload, "traitement"),
            EtatSante = ReadString(sourcePayload, "etatSante"),
            BilanFonctionnel = ReadString(sourcePayload, "bilanFonctionnel"),
            Prolongation = ReadString(sourcePayload, "prolongation"),
            Medecin = BuildCnamDoctorName(context),
            CodeCnam = context.CabinetCodeCnam.Trim(),
            Patient = BuildCnamPatientName(context),
            PatientAge = CalculateAge(context.PatientDateOfBirth).ToString(CultureInfo.InvariantCulture),
        };
    }

    private static List<CnamMedicationLineResponse> ReadAp1MedicationLines(Dictionary<string, JsonElement> payload)
    {
        var lines = ReadArray(payload, "medicationLines")
            .Select(item => new CnamMedicationLineResponse
            {
                Code = ReadString(item, "code"),
                Designation = ReadString(item, "designation"),
                Posologie = ReadString(item, "posologie"),
                DureeTraitement = ReadString(item, "dureeTraitement"),
            })
            .Where(item =>
                !string.IsNullOrWhiteSpace(item.Code) ||
                !string.IsNullOrWhiteSpace(item.Designation) ||
                !string.IsNullOrWhiteSpace(item.Posologie) ||
                !string.IsNullOrWhiteSpace(item.DureeTraitement))
            .ToList();

        if (lines.Count > 0)
        {
            return lines;
        }

        var legacyCode = ReadString(payload, "code");
        var legacyDesignation = ReadString(payload, "designation");
        var legacyPosologie = ReadString(payload, "posologie");
        var legacyDureeTraitement = ReadString(payload, "dureeTraitement");

        if (string.IsNullOrWhiteSpace(legacyCode) &&
            string.IsNullOrWhiteSpace(legacyDesignation) &&
            string.IsNullOrWhiteSpace(legacyPosologie) &&
            string.IsNullOrWhiteSpace(legacyDureeTraitement))
        {
            return [];
        }

        return
        [
            new CnamMedicationLineResponse
            {
                Code = legacyCode,
                Designation = legacyDesignation,
                Posologie = legacyPosologie,
                DureeTraitement = legacyDureeTraitement,
            },
        ];
    }

    private static Dictionary<string, JsonElement> ResolveCnamFormPayload(
        Dictionary<string, JsonElement>? payload,
        string selectedFormType)
    {
        if (payload is null || payload.Count == 0)
        {
            return new Dictionary<string, JsonElement>(StringComparer.Ordinal);
        }

        var nestedPayload = ReadObject(payload, selectedFormType);
        if (nestedPayload.ValueKind == JsonValueKind.Object)
        {
            return nestedPayload
                .EnumerateObject()
                .ToDictionary(
                    item => item.Name,
                    item => item.Value.Clone(),
                    StringComparer.Ordinal);
        }

        return payload;
    }

    private static string NormalizeCnamFormType(string rawValue)
    {
        var normalized = ConduiteActionKeys.NormalizeActionKey(rawValue);
        return normalized is "ap2" or "ap3" or "ap4" or "apci"
            ? normalized
            : "ap1";
    }

    private static string BuildCnamTemplateFileName(string selectedFormType)
    {
        return selectedFormType == "apci"
            ? "apci.pdf"
            : $"{selectedFormType.ToUpperInvariant()}.pdf";
    }

    private static string BuildCnamDoctorName(PrintContext context)
    {
        return string.Join(
                " ",
                new[] { context.DoctorFirstName, context.DoctorLastName }
                    .Where(value => !string.IsNullOrWhiteSpace(value))
                    .Select(value => value.Trim()))
            .Trim();
    }

    private static string BuildCnamPatientName(PrintContext context)
    {
        return string.Join(
                " ",
                new[] { context.PatientFirstName, context.PatientLastName }
                    .Where(value => !string.IsNullOrWhiteSpace(value))
                    .Select(value => value.Trim()))
            .Trim();
    }

    private static string BuildCnamFileName(string selectedFormType, PrintContext context)
    {
        var dateToken = DateTime.UtcNow.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        var patientFirstName = SanitizeFileToken(context.PatientFirstName);
        var patientLastName = SanitizeFileToken(context.PatientLastName);
        var patientToken = string.Join(
            "-",
            new[] { patientFirstName, patientLastName }.Where(value => !string.IsNullOrWhiteSpace(value)));

        if (string.IsNullOrWhiteSpace(patientToken))
        {
            patientToken = "patient";
        }

        return $"{selectedFormType.ToUpperInvariant()}-{patientToken}-{dateToken}.pdf";
    }
}
