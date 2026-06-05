using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using api.Src.Auth.Entities;
using api.Src.ConsultationSpace.Entities;
using api.Src.ConsultationSpace.InterrogationSection.Dtos.Requests;
using api.Src.ConsultationSpace.InterrogationSection.Dtos.Responses;
using api.Src.ConsultationSpace.InterrogationSection.Services;
using api.Src.PatientSpace.Entities;
using api.Src.SelfCheckin.Dtos;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace api.Src.SelfCheckin.Services;

public class SelfCheckinService(AppDbContext db, IInterrogatoireService interrogatoireService) : ISelfCheckinService
{
    private static readonly IReadOnlyList<string> DefaultMotifSuggestions =
    [
        "Fièvre",
        "Toux sèche",
        "Toux grasse",
        "Maux de gorge",
        "Dyspnée",
        "Douleur thoracique",
        "Palpitations",
        "Céphalée",
        "Vertiges",
        "Fatigue générale",
        "Douleur abdominale",
        "Nausées",
        "Vomissements",
        "Diarrhée",
        "Constipation",
        "Dysurie",
        "Pollakiurie",
        "Lombalgie",
        "Arthralgies",
        "Bilan de santé",
        "Renouvellement ordonnance",
        "Vaccination",
    ];

    public async Task<SelfCheckinDoctorContext> ValidateDoctorContext(Guid doctorId, string kioskKey)
    {
        if (doctorId == Guid.Empty)
        {
            throw new SelfCheckinException(
                code: "INVALID_DOCTOR_ID",
                message: "Invalid doctor id.",
                statusCode: StatusCodes.Status400BadRequest);
        }

        var trimmedKey = kioskKey?.Trim() ?? string.Empty;
        if (trimmedKey.Length == 0)
        {
            throw new SelfCheckinException(
                code: "INVALID_KIOSK_KEY",
                message: "Invalid kiosk credentials.",
                statusCode: StatusCodes.Status401Unauthorized);
        }

        var doctor = await db.Doctors
            .AsNoTracking()
            .Where(item => item.Id == doctorId)
            .Select(item => new
            {
                item.Id,
                item.CabinetIdentityId,
                item.Firstname,
                item.Lastname,
                item.SelfCheckinEnabled,
                item.SelfCheckinKey,
                item.SelfCheckinTimeoutSeconds,
            })
            .FirstOrDefaultAsync();

        if (doctor is null)
        {
            throw new SelfCheckinException(
                code: "DOCTOR_NOT_FOUND",
                message: "Doctor not found.",
                statusCode: StatusCodes.Status404NotFound);
        }

        if (!FixedTimeEquals(trimmedKey, doctor.SelfCheckinKey ?? string.Empty))
        {
            throw new SelfCheckinException(
                code: "INVALID_KIOSK_KEY",
                message: "Invalid kiosk credentials.",
                statusCode: StatusCodes.Status401Unauthorized);
        }

        var displayName = $"{doctor.Firstname} {doctor.Lastname}".Trim();
        var timeout = doctor.SelfCheckinTimeoutSeconds is >= 30 and <= 3600
            ? doctor.SelfCheckinTimeoutSeconds
            : 90;

        return new SelfCheckinDoctorContext(
            DoctorId: doctor.Id,
            CabinetIdentityId: doctor.CabinetIdentityId,
            DisplayName: string.IsNullOrWhiteSpace(displayName) ? "Cabinet" : displayName,
            Enabled: doctor.SelfCheckinEnabled,
            TimeoutSeconds: timeout);
    }

    public async Task<SelfCheckinBootstrapResponse> GetBootstrap(SelfCheckinDoctorContext doctorContext)
    {
        var motifs = await BuildMotifSuggestions(doctorContext.CabinetIdentityId);

        var professionOptions = await db.Patients
            .AsNoTracking()
            .Where(item =>
                item.CabinetIdentityId == doctorContext.CabinetIdentityId &&
                item.Profession != string.Empty)
            .Select(item => item.Profession)
            .Distinct()
            .ToListAsync();

        var treatmentOptions = await db.OngoingTreatmentMedicines
            .AsNoTracking()
            .Where(item =>
                item.Interrogatoire.Consultation.CabinetIdentityId == doctorContext.CabinetIdentityId &&
                item.Medicine != string.Empty)
            .Select(item => item.Medicine)
            .Distinct()
            .ToListAsync();

        return new SelfCheckinBootstrapResponse
        {
            Doctor = new SelfCheckinDoctorDto
            {
                Id = doctorContext.DoctorId,
                DisplayName = doctorContext.DisplayName,
                Speciality = string.Empty,
            },
            Enabled = doctorContext.Enabled,
            TimeoutSeconds = doctorContext.TimeoutSeconds,
            Motifs = motifs,
            ProfessionOptions = professionOptions
                .Select(value => NormalizeSpace(value))
                .Where(value => value.Length > 0)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(value => value)
                .Take(100)
                .ToList(),
            TreatmentOptions = treatmentOptions
                .Select(value => NormalizeSpace(value))
                .Where(value => value.Length > 0)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(value => value)
                .Take(100)
                .ToList(),
        };
    }

    public async Task<int> GetNextDossierNumber(SelfCheckinDoctorContext doctorContext)
    {
        EnsureEnabled(doctorContext);

        var nextDossierNumber = await db.Patients
            .Where(item => item.CabinetIdentityId == doctorContext.CabinetIdentityId)
            .Select(item => (int?)item.DossierNumber)
            .MaxAsync() ?? 0;

        return nextDossierNumber + 1;
    }

    public async Task<IReadOnlyList<SelfCheckinPatientSummary>> FindPatients(
        SelfCheckinDoctorContext doctorContext,
        SelfCheckinFindPatientRequest request)
    {
        EnsureEnabled(doctorContext);

        var searchType = NormalizeSpaceLower(request.SearchType);
        var lastname = NormalizeSpace(request.Nom);
        var firstname = NormalizeSpace(request.Prenom);
        var phone = NormalizeSpace(request.Tel);
        var email = NormalizeSpace(request.Email).ToLowerInvariant();
        var dossierRaw = NormalizeSpace(request.NumFiche);
        var hasDate = TryParseDateOnly(request.DateAnniversaire, out var dateOfBirth);

        var query = db.Patients
            .AsNoTracking()
            .Where(item => item.CabinetIdentityId == doctorContext.CabinetIdentityId);

        switch (searchType)
        {
            case "phone":
                if (phone.Length == 0)
                {
                    throw new SelfCheckinException("PHONE_REQUIRED", "Phone number is required.");
                }

                query = query.Where(item => item.PhoneNumber.ToLower().Contains(phone.ToLower()));
                break;

            case "name":
                if (lastname.Length == 0 || firstname.Length == 0)
                {
                    throw new SelfCheckinException("NAME_REQUIRED", "Both last name and first name are required.");
                }

                query = query.Where(item =>
                    (item.Lastname.ToLower().Contains(lastname.ToLower()) &&
                     item.Firstname.ToLower().Contains(firstname.ToLower())) ||
                    (item.Lastname.ToLower().Contains(firstname.ToLower()) &&
                     item.Firstname.ToLower().Contains(lastname.ToLower())));
                break;

            case "numfiche":
            case "num_fiche":
            case "dossier":
                if (!int.TryParse(dossierRaw, NumberStyles.Integer, CultureInfo.InvariantCulture, out var dossierNumber))
                {
                    throw new SelfCheckinException("DOSSIER_REQUIRED", "A valid dossier number is required.");
                }

                query = query.Where(item => item.DossierNumber == dossierNumber);
                break;

            case "email":
                if (email.Length == 0)
                {
                    throw new SelfCheckinException("EMAIL_REQUIRED", "Email is required.");
                }

                query = query.Where(item => item.Email.ToLower().Contains(email));
                break;

            case "":
                var hasAnyCriteria =
                    lastname.Length > 0 ||
                    firstname.Length > 0 ||
                    phone.Length > 0 ||
                    email.Length > 0 ||
                    dossierRaw.Length > 0 ||
                    hasDate;

                if (!hasAnyCriteria)
                {
                    throw new SelfCheckinException(
                        "SEARCH_CRITERIA_REQUIRED",
                        "At least one search field is required.");
                }

                if (lastname.Length > 0 && firstname.Length > 0)
                {
                    query = query.Where(item =>
                        (item.Lastname.ToLower().Contains(lastname.ToLower()) &&
                         item.Firstname.ToLower().Contains(firstname.ToLower())) ||
                        (item.Lastname.ToLower().Contains(firstname.ToLower()) &&
                         item.Firstname.ToLower().Contains(lastname.ToLower())));
                }
                else
                {
                    if (lastname.Length > 0)
                    {
                        query = query.Where(item =>
                            item.Lastname.ToLower().Contains(lastname.ToLower()) ||
                            item.Firstname.ToLower().Contains(lastname.ToLower()));
                    }

                    if (firstname.Length > 0)
                    {
                        query = query.Where(item =>
                            item.Firstname.ToLower().Contains(firstname.ToLower()) ||
                            item.Lastname.ToLower().Contains(firstname.ToLower()));
                    }
                }

                if (phone.Length > 0)
                {
                    query = query.Where(item => item.PhoneNumber.ToLower().Contains(phone.ToLower()));
                }

                if (email.Length > 0)
                {
                    query = query.Where(item => item.Email.ToLower().Contains(email));
                }

                if (dossierRaw.Length > 0 &&
                    int.TryParse(dossierRaw, NumberStyles.Integer, CultureInfo.InvariantCulture, out var optionalDossier))
                {
                    query = query.Where(item => item.DossierNumber == optionalDossier);
                }
                break;

            default:
                throw new SelfCheckinException(
                    "INVALID_SEARCH_TYPE",
                    "Invalid search type.");
        }

        if (hasDate)
        {
            var expectedDate = dateOfBirth.Date;
            query = query.Where(item => item.DateOfBirth.Date == expectedDate);
        }

        var patientsRaw = await query
            .OrderByDescending(item => item.CreatedAt)
            .Take(20)
            .Select(item => new
            {
                item.Id,
                item.Firstname,
                item.Lastname,
                item.Email,
                item.PhoneNumber,
                item.DossierNumber,
                item.DateOfBirth,
            })
            .ToListAsync();

        return patientsRaw.Select(item => new SelfCheckinPatientSummary
        {
            Id = item.Id,
            Firstname = item.Firstname,
            Lastname = item.Lastname,
            Email = item.Email,
            PhoneNumber = item.PhoneNumber,
            DossierNumber = item.DossierNumber,
            DateOfBirth = item.DateOfBirth.ToString("yyyy-MM-dd"),
        }).ToList();
    }

    public async Task<SelfCheckinPatientSummary> CreatePatient(
        SelfCheckinDoctorContext doctorContext,
        SelfCheckinCreatePatientRequest request)
    {
        EnsureEnabled(doctorContext);

        var firstname = NormalizeSpace(request.Firstname);
        var lastname = NormalizeSpace(request.Lastname);
        var sex = NormalizeSpace(request.Sex);

        if (firstname.Length == 0 || lastname.Length == 0)
        {
            throw new SelfCheckinException(
                "PATIENT_NAME_REQUIRED",
                "First name and last name are required.");
        }

        if (sex.Length == 0)
        {
            throw new SelfCheckinException("PATIENT_SEX_REQUIRED", "Sex is required.");
        }

        if (!DateTime.TryParse(request.DateOfBirth, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var parsedDateOfBirth))
        {
            throw new SelfCheckinException("PATIENT_DOB_REQUIRED", "Date of birth is required.");
        }

        var dateOfBirth = DateTime.SpecifyKind(parsedDateOfBirth.Date, DateTimeKind.Utc);
        if (dateOfBirth > DateTime.UtcNow.Date)
        {
            throw new SelfCheckinException("PATIENT_DOB_INVALID", "Date of birth cannot be in the future.");
        }

        var nextDossier = await GetNextDossierNumber(doctorContext);

        var patient = new Patient
        {
            Id = Guid.NewGuid(),
            CabinetIdentityId = doctorContext.CabinetIdentityId,
            DossierNumber = nextDossier,
            Firstname = firstname,
            Lastname = lastname,
            DateOfBirth = dateOfBirth,
            PhoneNumber = NormalizeSpace(request.PhoneNumber),
            Country = NormalizeSpace(request.Country, fallback: "Tunisie"),
            Profession = NormalizeSpace(request.Profession),
            WorkPlace = NormalizeSpace(request.WorkPlace),
            Sex = sex,
            FamilialStatus = NormalizeSpace(request.FamilialStatus),
            City = NormalizeSpace(request.City),
            Address = NormalizeSpace(request.Address),
            PostalCode = NormalizeSpace(request.PostalCode),
            Email = NormalizeSpace(request.Email).ToLowerInvariant(),
            APCI = NormalizeSpace(request.Apci),
            InsuranceType = NormalizeSpace(request.InsuranceType),
            InsuranceEstablishment = NormalizeSpace(request.InsuranceEstablishment),
        };

        db.Patients.Add(patient);

        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException pgEx && pgEx.SqlState == PostgresErrorCodes.UniqueViolation)
        {
            if (string.Equals(pgEx.ConstraintName, "IX_Patients_Email", StringComparison.OrdinalIgnoreCase))
            {
                throw new SelfCheckinException("PATIENT_EMAIL_ALREADY_EXISTS", "A patient with this email already exists.");
            }

            throw new SelfCheckinException("PATIENT_CREATE_CONFLICT", "Unable to create patient due to duplicate data.");
        }

        return MapPatientSummary(patient);
    }

    public async Task<SelfCheckinCreateConsultationResponse> CreateOrReuseConsultation(
        SelfCheckinDoctorContext doctorContext,
        SelfCheckinCreateConsultationRequest request)
    {
        EnsureEnabled(doctorContext);

        if (request.PatientId == Guid.Empty)
        {
            throw new SelfCheckinException("PATIENT_ID_REQUIRED", "Patient id is required.");
        }

        var patientExists = await db.Patients
            .AsNoTracking()
            .AnyAsync(item =>
                item.Id == request.PatientId &&
                item.CabinetIdentityId == doctorContext.CabinetIdentityId);

        if (!patientExists)
        {
            throw new SelfCheckinException(
                "PATIENT_NOT_FOUND",
                "Patient not found for this doctor.",
                StatusCodes.Status404NotFound);
        }

        var consultationDate = (request.ConsultationDate ?? DateTime.UtcNow).ToUniversalTime();
        var consultationDay = consultationDate.Date;
        var nextDay = consultationDay.AddDays(1);

        var existingConsultationId = await db.Consultations
            .AsNoTracking()
            .Where(item =>
                item.CabinetIdentityId == doctorContext.CabinetIdentityId &&
                item.PatientId == request.PatientId &&
                item.ConsultationDate >= consultationDay &&
                item.ConsultationDate < nextDay)
            .Select(item => item.Id)
            .FirstOrDefaultAsync();

        if (existingConsultationId != Guid.Empty)
        {
            var existing = await interrogatoireService.GetConsultationInterrogatoire(
                existingConsultationId,
                doctorContext.CabinetIdentityId);

            return new SelfCheckinCreateConsultationResponse
            {
                ConsultationId = existing.ConsultationId,
                Reused = true,
                Code = "CONSULTATION_ALREADY_EXISTS_SAME_DAY",
                Message = "Vous avez deja une consultation pour aujourd hui. Si cela semble incorrect, merci de contacter la secretaire.",
                Consultation = existing,
            };
        }

        var motifs = NormalizeMotifs(request.Motifs ?? []);
        if (motifs.Count == 0)
        {
            throw new SelfCheckinException("MOTIF_REQUIRED", "At least one motif is required.");
        }

        ConsultationInterrogatoireResponse created;
        try
        {
            created = await interrogatoireService.InitializeConsultation(
                new InitializeConsultationRequest
                {
                    PatientId = request.PatientId,
                    ConsultationDate = consultationDate,
                    Motifs = motifs,
                },
                doctorContext.CabinetIdentityId);
        }
        catch (InvalidOperationException ex) when (
            ex.Message.Contains("already exists", StringComparison.OrdinalIgnoreCase))
        {
            var duplicateConsultationId = await db.Consultations
                .AsNoTracking()
                .Where(item =>
                    item.CabinetIdentityId == doctorContext.CabinetIdentityId &&
                    item.PatientId == request.PatientId &&
                    item.ConsultationDate >= consultationDay &&
                    item.ConsultationDate < nextDay)
                .Select(item => item.Id)
                .FirstOrDefaultAsync();

            if (duplicateConsultationId == Guid.Empty)
            {
                throw;
            }

            var existing = await interrogatoireService.GetConsultationInterrogatoire(
                duplicateConsultationId,
                doctorContext.CabinetIdentityId);

            return new SelfCheckinCreateConsultationResponse
            {
                ConsultationId = existing.ConsultationId,
                Reused = true,
                Code = "CONSULTATION_ALREADY_EXISTS_SAME_DAY",
                Message = "Vous avez deja une consultation pour aujourd hui. Si cela semble incorrect, merci de contacter la secretaire.",
                Consultation = existing,
            };
        }

        return new SelfCheckinCreateConsultationResponse
        {
            ConsultationId = created.ConsultationId,
            Reused = false,
            Code = "CONSULTATION_CREATED",
            Message = "Consultation creee avec succes.",
            Consultation = created,
        };
    }

    public async Task<IReadOnlyList<string>> PatchMotifs(
        SelfCheckinDoctorContext doctorContext,
        Guid consultationId,
        SelfCheckinPatchMotifRequest request)
    {
        EnsureEnabled(doctorContext);
        await EnsureConsultationOwnership(doctorContext, consultationId);

        var motifs = NormalizeMotifs(request.Motifs ?? []);
        if (motifs.Count == 0)
        {
            throw new SelfCheckinException("MOTIF_REQUIRED", "At least one motif is required.");
        }

        await db.ConsultationMotifs
            .Where(item => item.ConsultationId == consultationId)
            .ExecuteDeleteAsync();

        var toCreate = motifs.Select(motif => new ConsultationMotif
        {
            Id = Guid.NewGuid(),
            ConsultationId = consultationId,
            Value = motif,
            ValueNormalized = NormalizeSpaceLower(motif),
        });

        await db.ConsultationMotifs.AddRangeAsync(toCreate);
        await db.SaveChangesAsync();

        return motifs;
    }

    public async Task<ConsultationInterrogatoireResponse> PatchInterrogatoire(
        SelfCheckinDoctorContext doctorContext,
        Guid consultationId,
        SelfCheckinPatchInterrogatoireRequest request)
    {
        EnsureEnabled(doctorContext);
        await EnsureConsultationOwnership(doctorContext, consultationId);

        var motifs = await db.ConsultationMotifs
            .AsNoTracking()
            .Where(item => item.ConsultationId == consultationId)
            .OrderBy(item => item.CreatedAt)
            .Select(item => item.Value)
            .ToListAsync();

        var normalizedMotifs = NormalizeMotifs(motifs);

        var anomalies = (request.Anomalies ?? [])
            .Where(item => IsAllowedSection(item.Section))
            .Select((item, index) => new UpdateInterrogatoireAnomalyRequest
            {
                Section = NormalizeSection(item.Section),
                IsCustom = item.IsCustom,
                TemplateKey = NormalizeTemplateKey(item.TemplateKey),
                SortOrder = item.SortOrder >= 0 ? item.SortOrder : index,
                Payload = item.Payload ?? [],
            })
            .ToList();

        var treatments = (request.OngoingTreatments ?? [])
            .Select(item => new UpdateOngoingTreatmentMedicineRequest
            {
                Medicine = NormalizeSpace(item.Medicine, maxLength: 180),
                TherapeuticClass = NormalizeSpace(item.TherapeuticClass, maxLength: 120),
                Category = NormalizeSpace(item.Category, maxLength: 120),
                Posology = NormalizeSpace(item.Posology, maxLength: 400),
                Duration = NormalizeSpace(item.Duration, maxLength: 80),
                Date = NormalizeSpace(item.Date, maxLength: 20),
            })
            .Where(item => item.Medicine.Length > 0)
            .ToList();

        await interrogatoireService.UpdateConsultationData(
            consultationId,
            new UpdateConsultationDataRequest
            {
                Motifs = normalizedMotifs,
                HistoireMaladie = NormalizeHistoireMaladie(request.HistoireMaladie),
                Diagnostics = NormalizeTextList(request.Diagnostics ?? [], maxLength: 220),
                Anomalies = anomalies,
                OngoingTreatments = treatments,
            },
            doctorContext.CabinetIdentityId,
            updateTreatmentCatalog: false);

        return await interrogatoireService.GetConsultationInterrogatoire(
            consultationId,
            doctorContext.CabinetIdentityId);
    }

    private static bool IsAllowedSection(string section)
    {
        var normalized = NormalizeSection(section);
        return normalized is "medical" or "family" or "surgical";
    }

    private static string NormalizeSection(string section)
    {
        var normalized = NormalizeSpaceLower(section);
        return normalized switch
        {
            "medical" => "medical",
            "family" => "family",
            "surgical" => "surgical",
            _ => "medical",
        };
    }

    private static string? NormalizeTemplateKey(string? templateKey)
    {
        var normalized = NormalizeSpace(templateKey ?? string.Empty, maxLength: 140);
        return normalized.Length == 0 ? null : normalized;
    }

    private static string NormalizeHistoireMaladie(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        return value.Replace("\r\n", "\n").Trim();
    }

    private async Task EnsureConsultationOwnership(SelfCheckinDoctorContext doctorContext, Guid consultationId)
    {
        if (consultationId == Guid.Empty)
        {
            throw new SelfCheckinException("CONSULTATION_ID_REQUIRED", "Consultation id is required.");
        }

        var exists = await db.Consultations
            .AsNoTracking()
            .AnyAsync(item =>
                item.Id == consultationId &&
                item.CabinetIdentityId == doctorContext.CabinetIdentityId);

        if (!exists)
        {
            throw new SelfCheckinException(
                "CONSULTATION_NOT_FOUND",
                "Consultation not found.",
                StatusCodes.Status404NotFound);
        }
    }

    private static void EnsureEnabled(SelfCheckinDoctorContext doctorContext)
    {
        if (doctorContext.Enabled)
        {
            return;
        }

        throw new SelfCheckinException(
            code: "SELF_CHECKIN_DISABLED",
            message: "Self check-in is disabled for this doctor.",
            statusCode: StatusCodes.Status403Forbidden);
    }

    private async Task<List<string>> BuildMotifSuggestions(Guid cabinetIdentityId)
    {
        var recentMotifs = await db.ConsultationMotifs
            .AsNoTracking()
            .Where(item => item.Consultation.CabinetIdentityId == cabinetIdentityId)
            .OrderByDescending(item => item.CreatedAt)
            .Select(item => item.Value)
            .Take(300)
            .ToListAsync();

        var byNormalized = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        foreach (var defaultMotif in DefaultMotifSuggestions)
        {
            var normalized = NormalizeSpaceLower(defaultMotif);
            if (normalized.Length == 0 || byNormalized.ContainsKey(normalized))
            {
                continue;
            }

            byNormalized[normalized] = NormalizeSpace(defaultMotif);
        }

        foreach (var motif in recentMotifs)
        {
            var normalized = NormalizeSpaceLower(motif);
            if (normalized.Length == 0 || byNormalized.ContainsKey(normalized))
            {
                continue;
            }

            byNormalized[normalized] = NormalizeSpace(motif);
        }

        return byNormalized
            .Values
            .OrderBy(item => item)
            .Take(120)
            .ToList();
    }

    private static SelfCheckinPatientSummary MapPatientSummary(Patient patient)
    {
        return new SelfCheckinPatientSummary
        {
            Id = patient.Id,
            Firstname = patient.Firstname,
            Lastname = patient.Lastname,
            Email = patient.Email,
            PhoneNumber = patient.PhoneNumber,
            DossierNumber = patient.DossierNumber,
            DateOfBirth = patient.DateOfBirth.ToString("yyyy-MM-dd"),
        };
    }

    private static string NormalizeSpace(string value, int maxLength = 300, string fallback = "")
    {
        var normalized = string.Join(' ', (value ?? string.Empty)
            .Trim()
            .Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));

        if (normalized.Length > maxLength)
        {
            normalized = normalized[..maxLength];
        }

        if (normalized.Length == 0 && fallback.Length > 0)
        {
            return fallback;
        }

        return normalized;
    }

    private static string NormalizeSpaceLower(string value)
    {
        var compact = NormalizeSpace(value);
        if (compact.Length == 0)
        {
            return string.Empty;
        }

        var decomposed = compact
            .ToLowerInvariant()
            .Normalize(NormalizationForm.FormD);

        var builder = new StringBuilder(decomposed.Length);
        foreach (var ch in decomposed)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) == UnicodeCategory.NonSpacingMark)
            {
                continue;
            }

            if (ch is 'œ')
            {
                builder.Append("oe");
                continue;
            }

            builder.Append(char.IsLetterOrDigit(ch) ? ch : ' ');
        }

        return string.Join(
            ' ',
            builder
                .ToString()
                .Normalize(NormalizationForm.FormC)
                .Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
    }

    private static bool TryParseDateOnly(string rawValue, out DateTime parsedDate)
    {
        parsedDate = default;
        var normalized = NormalizeSpace(rawValue);
        if (normalized.Length == 0)
        {
            return false;
        }

        if (DateTime.TryParseExact(
            normalized,
            "yyyy-MM-dd",
            CultureInfo.InvariantCulture,
            DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal,
            out var parsedExact))
        {
            parsedDate = parsedExact.Date;
            return true;
        }

        if (DateTime.TryParse(
            normalized,
            CultureInfo.InvariantCulture,
            DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal,
            out var parsedLoose))
        {
            parsedDate = parsedLoose.Date;
            return true;
        }

        return false;
    }

    private static List<string> NormalizeTextList(IEnumerable<string> values, int maxLength)
    {
        var byNormalized = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        foreach (var value in values)
        {
            var normalized = NormalizeSpace(value, maxLength);
            if (normalized.Length == 0)
            {
                continue;
            }

            var key = NormalizeSpaceLower(normalized);
            if (!byNormalized.ContainsKey(key))
            {
                byNormalized[key] = normalized;
            }
        }

        return byNormalized.Values.ToList();
    }

    private static List<string> NormalizeMotifs(IEnumerable<string>? motifs)
    {
        if (motifs is null)
        {
            return [];
        }

        return NormalizeTextList(motifs, maxLength: 120);
    }

    private static bool FixedTimeEquals(string left, string right)
    {
        var leftBytes = Encoding.UTF8.GetBytes(left);
        var rightBytes = Encoding.UTF8.GetBytes(right);

        if (leftBytes.Length == 0 || rightBytes.Length == 0 || leftBytes.Length != rightBytes.Length)
        {
            return false;
        }

        return CryptographicOperations.FixedTimeEquals(leftBytes, rightBytes);
    }
}
