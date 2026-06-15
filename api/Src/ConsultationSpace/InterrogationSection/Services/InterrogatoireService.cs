using System.Globalization;
using System.Text;
using System.Text.Json;
using api.DatabaseRules;
using api.Src.ConsultationSpace.Catalogs;
using api.Src.ConsultationSpace.Entities;
using api.Src.ConsultationSpace.InterrogationSection.Dtos.Requests;
using api.Src.ConsultationSpace.InterrogationSection.Dtos.Responses;
using api.Src.ConsultationSpace.InterrogationSection.Entities;
using api.Src.Realtime;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace api.Src.ConsultationSpace.InterrogationSection.Services;

public class InterrogatoireService(AppDbContext db, IWaitingRoomNotifier waitingRoomNotifier) : IInterrogatoireService
{
    private static readonly object SeededCatalogCabinetsLock = new();
    private static readonly HashSet<Guid> SeededCatalogCabinets = [];

    private static readonly IReadOnlyList<InterrogatoireAnomalyCatalogItemResponse> DefaultCatalog =
    [
        new() { Section = "medical", IsCustom = false, TemplateKey = "hta", Label = "HTA" },
        new() { Section = "medical", IsCustom = false, TemplateKey = "diabete", Label = "Diabète" },
        new() { Section = "medical", IsCustom = false, TemplateKey = "grossesse-en-cours", Label = "Grossesse en cours" },
        new() { Section = "medical", IsCustom = false, TemplateKey = "terrain-atopique", Label = "Terrain atopique" },
        new() { Section = "medical", IsCustom = false, TemplateKey = "terrain-immunodepression", Label = "Terrain d'immunodépression" },
        new() { Section = "medical", IsCustom = false, TemplateKey = "maladie-dysimmunitaire", Label = "Maladie dysimmunitaire" },
        new() { Section = "medical", IsCustom = false, TemplateKey = "maladie-neurologique", Label = "Maladie neurologique" },
        new() { Section = "medical", IsCustom = false, TemplateKey = "notion-vaccination-recente", Label = "Notion de vaccination récente" },
        new() { Section = "medical", IsCustom = false, TemplateKey = "notion-anesthesie-recente", Label = "Notion d'anesthésie récente" },
        new() { Section = "medical", IsCustom = false, TemplateKey = "cas-particulier-nourrisson-enfant", Label = "Cas particulier : nourrisson/enfant" },
        new() { Section = "medical", IsCustom = false, Category = "laser", TemplateKey = "dermatologic-antecedent-laser-epilation", Label = "Epilation laser" },
        new() { Section = "medical", IsCustom = false, Category = "laser", TemplateKey = "dermatologic-antecedent-laser-vasculaire", Label = "Laser vasculaire" },
        new() { Section = "medical", IsCustom = false, Category = "laser", TemplateKey = "dermatologic-antecedent-laser-pigmentaire", Label = "Laser pigmentaire" },
        new() { Section = "medical", IsCustom = false, Category = "laser", TemplateKey = "dermatologic-antecedent-laser-detatouage", Label = "Detatouage laser" },
        new() { Section = "medical", IsCustom = false, Category = "laser", TemplateKey = "dermatologic-antecedent-laser-co2-fractionne", Label = "Laser CO2 fractionne" },
        new() { Section = "medical", IsCustom = false, Category = "laser", TemplateKey = "dermatologic-antecedent-laser-erbium", Label = "Laser Erbium resurfacing" },
        new() { Section = "medical", IsCustom = false, Category = "laser", TemplateKey = "dermatologic-antecedent-laser-cicatrices-acne", Label = "Laser cicatrices d acne" },
        new() { Section = "medical", IsCustom = false, Category = "laser", TemplateKey = "dermatologic-antecedent-laser-angiome", Label = "Laser angiome" },
        new() { Section = "medical", IsCustom = false, Category = "laser", TemplateKey = "dermatologic-antecedent-laser-complication-post-laser", Label = "Complication post-laser" },
        new() { Section = "surgical", IsCustom = false, Category = "surgical", TemplateKey = "dermatologic-antecedent-surgical-biopsie-cutanee", Label = "Biopsie cutanee" },
        new() { Section = "surgical", IsCustom = false, Category = "surgical", TemplateKey = "dermatologic-antecedent-surgical-exerese-naevus", Label = "Exerese de naevus" },
        new() { Section = "surgical", IsCustom = false, Category = "surgical", TemplateKey = "dermatologic-antecedent-surgical-exerese-kyste-lipome", Label = "Exerese de kyste ou lipome" },
        new() { Section = "surgical", IsCustom = false, Category = "surgical", TemplateKey = "dermatologic-antecedent-surgical-exerese-carcinome-basocellulaire", Label = "Exerese de carcinome basocellulaire" },
        new() { Section = "surgical", IsCustom = false, Category = "surgical", TemplateKey = "dermatologic-antecedent-surgical-exerese-carcinome-epidermoide", Label = "Exerese de carcinome epidermoide" },
        new() { Section = "surgical", IsCustom = false, Category = "surgical", TemplateKey = "dermatologic-antecedent-surgical-exerese-melanome", Label = "Exerese de melanome" },
        new() { Section = "surgical", IsCustom = false, Category = "surgical", TemplateKey = "dermatologic-antecedent-surgical-greffe-lambeau-cutane", Label = "Greffe ou lambeau cutane" },
        new() { Section = "surgical", IsCustom = false, Category = "surgical", TemplateKey = "dermatologic-antecedent-surgical-cicatrice-hypertrophique-cheloide", Label = "Cicatrice hypertrophique ou cheloide" },
        new() { Section = "surgical", IsCustom = false, Category = "surgical", TemplateKey = "dermatologic-antecedent-surgical-incision-drainage-abces", Label = "Incision drainage d abces" },
        new() { Section = "surgical", IsCustom = false, Category = "surgical", TemplateKey = "dermatologic-antecedent-surgical-chirurgie-esthetique-cutanee", Label = "Chirurgie esthetique cutanee" },
        new() { Section = "medical", IsCustom = false, Category = "general", TemplateKey = "dermatologic-antecedent-general-dermatite-atopique-eczema", Label = "Dermatite atopique eczema" },
        new() { Section = "medical", IsCustom = false, Category = "general", TemplateKey = "dermatologic-antecedent-general-psoriasis", Label = "Psoriasis" },
        new() { Section = "medical", IsCustom = false, Category = "general", TemplateKey = "dermatologic-antecedent-general-acne", Label = "Acne" },
        new() { Section = "medical", IsCustom = false, Category = "general", TemplateKey = "dermatologic-antecedent-general-rosacee", Label = "Rosacee" },
        new() { Section = "medical", IsCustom = false, Category = "general", TemplateKey = "dermatologic-antecedent-general-urticaire-chronique", Label = "Urticaire chronique" },
        new() { Section = "medical", IsCustom = false, Category = "general", TemplateKey = "dermatologic-antecedent-general-vitiligo", Label = "Vitiligo" },
        new() { Section = "medical", IsCustom = false, Category = "general", TemplateKey = "dermatologic-antecedent-general-melasma", Label = "Melasma" },
        new() { Section = "medical", IsCustom = false, Category = "general", TemplateKey = "dermatologic-antecedent-general-dermatite-seborrheique", Label = "Dermatite seborrheique" },
        new() { Section = "medical", IsCustom = false, Category = "general", TemplateKey = "dermatologic-antecedent-general-lupus-cutane", Label = "Lupus cutane" },
        new() { Section = "medical", IsCustom = false, Category = "general", TemplateKey = "dermatologic-antecedent-general-lichen-plan", Label = "Lichen plan" },
        new() { Section = "medical", IsCustom = false, Category = "general", TemplateKey = "dermatologic-antecedent-general-hidradenite-suppuree", Label = "Hidradenite suppuree" },
        new() { Section = "medical", IsCustom = false, Category = "general", TemplateKey = "dermatologic-antecedent-general-alopecie", Label = "Alopecie" },
        new() { Section = "medical", IsCustom = false, Category = "general", TemplateKey = "dermatologic-antecedent-general-herpes-recidivant", Label = "Herpes recidivant" },
        new() { Section = "medical", IsCustom = false, Category = "general", TemplateKey = "dermatologic-antecedent-general-zona", Label = "Zona" },
        new() { Section = "medical", IsCustom = false, Category = "general", TemplateKey = "dermatologic-antecedent-general-verrues-hpv", Label = "Verrues HPV" },
        new() { Section = "medical", IsCustom = false, Category = "general", TemplateKey = "dermatologic-antecedent-general-molluscum-contagiosum", Label = "Molluscum contagiosum" },
        new() { Section = "medical", IsCustom = false, Category = "general", TemplateKey = "dermatologic-antecedent-general-impetigo", Label = "Impetigo" },
        new() { Section = "medical", IsCustom = false, Category = "general", TemplateKey = "dermatologic-antecedent-general-folliculite", Label = "Folliculite" },
        new() { Section = "medical", IsCustom = false, Category = "general", TemplateKey = "dermatologic-antecedent-general-mycose-cutanee-dermatophytie", Label = "Mycose cutanee dermatophytie" },
        new() { Section = "medical", IsCustom = false, Category = "general", TemplateKey = "dermatologic-antecedent-general-candidose-cutanee", Label = "Candidose cutanee" },
        new() { Section = "medical", IsCustom = false, Category = "general", TemplateKey = "dermatologic-antecedent-general-gale", Label = "Gale" },
        new() { Section = "medical", IsCustom = false, Category = "general", TemplateKey = "dermatologic-antecedent-general-pediculose", Label = "Pediculose" },
        new() { Section = "medical", IsCustom = false, Category = "general", TemplateKey = "dermatologic-antecedent-general-cancer-cutane-personnel", Label = "Cancer cutane personnel" },
        new() { Section = "family", IsCustom = false, TemplateKey = "family-hypertension-arterielle", Label = "Hypertension artérielle familiale" },
        new() { Section = "family", IsCustom = false, TemplateKey = "family-diabete", Label = "Diabète familial" },
        new() { Section = "family", IsCustom = false, TemplateKey = "family-dyslipidemie", Label = "Dyslipidémie familiale" },
        new() { Section = "family", IsCustom = false, TemplateKey = "family-cardiopathie-ischemique-premature", Label = "Cardiopathie ischémique prématurée familiale" },
        new() { Section = "family", IsCustom = false, TemplateKey = "family-avc", Label = "AVC familial" },
        new() { Section = "family", IsCustom = false, TemplateKey = "family-insuffisance-renale-chronique", Label = "Insuffisance rénale chronique familiale" },
        new() { Section = "family", IsCustom = false, TemplateKey = "family-maladie-thyroidienne", Label = "Maladie thyroïdienne familiale" },
        new() { Section = "family", IsCustom = false, TemplateKey = "family-asthme-atopie", Label = "Asthme ou terrain atopique familial" },
        new() { Section = "family", IsCustom = false, TemplateKey = "family-maladie-auto-immune", Label = "Maladie auto-immune familiale" },
        new() { Section = "family", IsCustom = false, TemplateKey = "family-epilepsie", Label = "Épilepsie familiale" },
        new() { Section = "family", IsCustom = false, TemplateKey = "family-cancer-colorectal", Label = "Cancer colorectal familial" },
        new() { Section = "family", IsCustom = false, TemplateKey = "family-cancer-sein-ovaire", Label = "Cancer du sein ou de l'ovaire familial" },
        new() { Section = "family", IsCustom = false, TemplateKey = "family-cancer-prostate", Label = "Cancer de la prostate familial" },
    ];

    private static readonly IReadOnlyDictionary<string, string> DefaultMotifLabelsByKey = new[]
    {
        "Fièvre",
        "Toux sèche",
        "Toux grasse",
        "Rhinorrhée",
        "Maux de gorge",
        "Dyspnée",
        "Douleur thoracique",
        "Palpitations",
        "Céphalée",
        "Vertiges",
        "Fatigue générale",
        "Asthénie",
        "Douleur abdominale",
        "Nausées",
        "Vomissements",
        "Diarrhée",
        "Constipation",
        "Brûlures épigastriques",
        "Reflux gastro-œsophagien",
        "Dysurie",
        "Pollakiurie",
        "Hématurie",
        "Infection urinaire suspectée",
        "Douleur lombaire",
        "Lombalgie",
        "Sciatalgie",
        "Douleur cervicale",
        "Douleur épaule",
        "Arthralgies",
        "Myalgies",
        "Entorse",
        "Traumatisme mineur",
        "Éruption cutanée",
        "Prurit",
        "Plaie simple",
        "Brûlure mineure",
        "Rhinite allergique",
        "Allergie saisonnière",
        "Sinusite suspectée",
        "Otalgie",
        "Otite suspectée",
        "Conjonctivite",
        "Bronchite suspectée",
        "Crise d'asthme",
        "Suivi HTA",
        "Suivi diabète",
        "Suivi hypothyroïdie",
        "Bilan de santé",
        "Renouvellement ordonnance",
        "Certificat médical",
        "Vaccination",
        "Insomnie",
        "Anxiété",
        "Humeur dépressive",
        "Sevrage tabagique",
        "Perte de poids",
        "Prise de poids",
        "Œdèmes des membres inférieurs",
        "Douleur pelvienne",
        "Troubles menstruels",
        "Aménorrhée",
        "Contraception",
        "Suivi grossesse",
        "Contrôle post-hospitalisation",
    }
        .GroupBy(NormalizeMotifKey)
        .ToDictionary(group => group.Key, group => group.First(), StringComparer.Ordinal);

    public async Task SeedGeneralPracticeTreatmentCatalogForAllCabinets()
    {
        var cabinetIds = await db.CabinetIdentities
            .AsNoTracking()
            .Select(item => item.Id)
            .ToListAsync();

        foreach (var cabinetId in cabinetIds)
        {
            await EnsureGeneralPracticeTreatmentCatalogSeeded(cabinetId);
        }
    }

    public async Task RefreshGeneralPracticeTreatmentCatalogAccentsForAllCabinets()
    {
        var cabinetIds = await db.CabinetIdentities
            .AsNoTracking()
            .Select(item => item.Id)
            .ToListAsync();

        foreach (var cabinetId in cabinetIds)
        {
            await RefreshGeneralPracticeTreatmentCatalogAccents(cabinetId);
        }

        await RefreshStoredDefaultMotifAccents();
    }

    public async Task<ConsultationInterrogatoireResponse> InitializeConsultation(InitializeConsultationRequest request, Guid cabinetIdentityId)
    {
        if (request.PatientId == Guid.Empty) throw new InvalidOperationException("PatientId is required.");

        var consultationDate = request.ConsultationDate;
        var consultationDay = consultationDate.Date;
        if (consultationDate == default) throw new InvalidOperationException("ConsultationDate is required.");

        var motifs = NormalizeMotifs(request.Motifs);
        if (motifs.Count == 0) throw new InvalidOperationException("At least one motif is required.");

        var cabinetIdentity = await db.CabinetIdentities
            .AsNoTracking()
            .Where(ci => ci.Id == cabinetIdentityId)
            .Select(ci => new { ci.IsActive, ci.IsFlaggedForDeletion })
            .FirstOrDefaultAsync() ?? throw new InvalidOperationException("Cabinet identity not found.");

        if (!cabinetIdentity.IsActive) throw new InvalidOperationException("Cabinet identity is not active.");
        if (cabinetIdentity.IsFlaggedForDeletion) throw new InvalidOperationException("Cabinet identity is flagged for deletion.");

        var patientExists = await db.Patients
            .AsNoTracking()
            .AnyAsync(p => p.Id == request.PatientId && p.CabinetIdentityId == cabinetIdentityId);
        if (!patientExists) throw new InvalidOperationException("Patient not found for this cabinet.");

        var sameDayConsultation = await db.Consultations
            .AsNoTracking()
            .Where(c =>
                c.PatientId == request.PatientId &&
                c.CabinetIdentityId == cabinetIdentityId &&
                c.ConsultationDate.Date == consultationDay)
            .Select(c => new { c.Id, c.IsDone, c.IsTimerPaused, c.DurationSeconds })
            .FirstOrDefaultAsync();

        if (sameDayConsultation is not null)
        {
            if (sameDayConsultation.IsDone)
            {
                throw new InvalidOperationException("This consultation is already finished and cannot be restarted.");
            }

            if (!sameDayConsultation.IsTimerPaused && sameDayConsultation.DurationSeconds <= 0)
            {
                var existingConsultation = await db.Consultations
                    .FirstOrDefaultAsync(c => c.Id == sameDayConsultation.Id && c.CabinetIdentityId == cabinetIdentityId);

                if (existingConsultation is not null)
                {
                    existingConsultation.IsTimerPaused = true;
                    await db.SaveChangesAsync();
                }
            }

            return await GetConsultationInterrogatoire(sameDayConsultation.Id, cabinetIdentityId);
        }

        var previousConsultationId = await db.Consultations
            .AsNoTracking()
            .Where(c =>
                c.PatientId == request.PatientId &&
                c.CabinetIdentityId == cabinetIdentityId &&
                c.ConsultationDate.Date < consultationDay)
            .OrderByDescending(c => c.ConsultationDate)
            .Select(c => (Guid?)c.Id)
            .FirstOrDefaultAsync();

        var copiedAnomalies = new List<InterrogatoireAnomaly>();
        var copiedTreatments = new List<OngoingTreatmentMedicine>();
        var copiedHistoireMaladie = string.Empty;
        var copiedDiagnostics = Array.Empty<string>();

        if (previousConsultationId.HasValue)
        {
            var previousAnomalies = await db.InterrogatoireAnomalies
                .AsNoTracking()
                .Where(a => a.ConsultationId == previousConsultationId.Value)
                .OrderBy(a => a.SortOrder)
                .ThenBy(a => a.CreatedAt)
                .Select(a => new
                {
                    a.Section,
                    a.IsCustom,
                    a.TemplateKey,
                    a.SortOrder,
                    a.Payload
                })
                .ToListAsync();

            copiedAnomalies = previousAnomalies.Select(a => new InterrogatoireAnomaly
            {
                Id = Guid.NewGuid(),
                Section = a.Section,
                IsCustom = a.IsCustom,
                TemplateKey = a.TemplateKey,
                SortOrder = a.SortOrder,
                Payload = ClonePayload(a.Payload)
            }).ToList();

            var previousTreatments = await db.OngoingTreatmentMedicines
                .AsNoTracking()
                .Where(t => t.ConsultationId == previousConsultationId.Value)
                .OrderBy(t => t.CreatedAt)
                .Select(t => new
                {
                    t.Medicine,
                    t.TherapeuticClass,
                    t.Category,
                    t.Posology,
                    t.Duration,
                    t.Date,
                })
                .ToListAsync();

            copiedTreatments = previousTreatments.Select(t => new OngoingTreatmentMedicine
            {
                Id = Guid.NewGuid(),
                Medicine = t.Medicine,
                TherapeuticClass = t.TherapeuticClass,
                Category = t.Category,
                Posology = t.Posology,
                Duration = t.Duration,
                Date = t.Date,
            }).ToList();

            var previousInterrogatoire = await db.Interrogatoires
                .AsNoTracking()
                .Where(i => i.ConsultationId == previousConsultationId.Value)
                .Select(i => new
                {
                    i.HistoireMaladie,
                    i.Diagnostics
                })
                .FirstOrDefaultAsync();

            if (previousInterrogatoire is not null)
            {
                copiedHistoireMaladie = previousInterrogatoire.HistoireMaladie;
                copiedDiagnostics = NormalizeDiagnostics(previousInterrogatoire.Diagnostics).ToArray();
            }
        }

        var consultationId = Guid.NewGuid();
        var consultation = new Consultation
        {
            Id = consultationId,
            PatientId = request.PatientId,
            CabinetIdentityId = cabinetIdentityId,
            ConsultationDate = consultationDate,
            DurationSeconds = 0,
            IsTimerPaused = true,
            IsDone = false,
            Motifs = motifs.Select(m => new ConsultationMotif
            {
                Id = Guid.NewGuid(),
                ConsultationId = consultationId,
                Value = m.Original,
                ValueNormalized = m.Normalized
            }).ToList(),
            Interrogatoire = new Interrogatoire
            {
                ConsultationId = consultationId,
                HistoireMaladie = copiedHistoireMaladie,
                Diagnostics = copiedDiagnostics,
                Anomalies = copiedAnomalies.Select(a =>
                {
                    a.ConsultationId = consultationId;
                    return a;
                }).ToList(),
                OngoingTreatments = copiedTreatments.Select(t =>
                {
                    t.ConsultationId = consultationId;
                    return t;
                }).ToList()
            }
        };

        db.Consultations.Add(consultation);
        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException pgEx && pgEx.SqlState == "23505")
        {
            throw new InvalidOperationException("A consultation already exists for this patient on this date.");
        }

        await waitingRoomNotifier.NotifyCabinetUpdated(
            cabinetIdentityId,
            consultation.Id,
            "consultation-initialized");

        return new ConsultationInterrogatoireResponse
        {
            ConsultationId = consultation.Id,
            PatientId = consultation.PatientId,
            CabinetIdentityId = consultation.CabinetIdentityId,
            ConsultationDate = consultation.ConsultationDate,
            Duration = FormatDuration(consultation.DurationSeconds),
            IsTimerPaused = consultation.IsTimerPaused,
            IsDone = consultation.IsDone,
            Motifs = consultation.Motifs.Select(m => m.Value).ToList(),
            HistoireMaladie = consultation.Interrogatoire.HistoireMaladie,
            Diagnostics = NormalizeDiagnostics(consultation.Interrogatoire.Diagnostics).ToList(),
            CopiedFromPreviousConsultation = previousConsultationId.HasValue,
            SourceConsultationId = previousConsultationId,
            Anomalies = consultation.Interrogatoire.Anomalies.Select(MapAnomaly).ToList(),
            OngoingTreatments = consultation.Interrogatoire.OngoingTreatments.Select(MapTreatment).ToList()
        };
    }

    public async Task<ConsultationInterrogatoireResponse> GetConsultationInterrogatoire(Guid consultationId, Guid cabinetIdentityId)
    {
        var consultation = await db.Consultations
            .AsNoTracking()
            .Where(c => c.Id == consultationId && c.CabinetIdentityId == cabinetIdentityId)
            .Select(c => new
            {
                c.Id,
                c.PatientId,
                c.CabinetIdentityId,
                c.ConsultationDate,
                c.DurationSeconds,
                c.IsTimerPaused,
                c.IsDone
            })
            .FirstOrDefaultAsync() ?? throw new InvalidOperationException("Consultation not found.");

        var motifs = await db.ConsultationMotifs
            .AsNoTracking()
            .Where(m => m.ConsultationId == consultationId)
            .OrderBy(m => m.CreatedAt)
            .Select(m => m.Value)
            .ToListAsync();

        var interrogatoire = await db.Interrogatoires
            .AsNoTracking()
            .Where(i => i.ConsultationId == consultationId)
            .Select(i => new
            {
                i.HistoireMaladie,
                i.Diagnostics,
            })
            .FirstOrDefaultAsync()
            ?? new
            {
                HistoireMaladie = string.Empty,
                Diagnostics = Array.Empty<string>(),
            };

        var anomalies = await db.InterrogatoireAnomalies
            .AsNoTracking()
            .Where(a => a.ConsultationId == consultationId)
            .OrderBy(a => a.SortOrder)
            .ThenBy(a => a.CreatedAt)
            .Select(a => new InterrogatoireAnomalyResponse
            {
                Id = a.Id,
                Section = a.Section.ToString().ToLowerInvariant(),
                IsCustom = a.IsCustom,
                TemplateKey = a.TemplateKey,
                SortOrder = a.SortOrder,
                Payload = a.Payload
            })
            .ToListAsync();

        var treatments = await db.OngoingTreatmentMedicines
            .AsNoTracking()
            .Where(t => t.ConsultationId == consultationId)
            .OrderBy(t => t.CreatedAt)
            .Select(t => new OngoingTreatmentMedicineResponse
            {
                Id = t.Id,
                Medicine = t.Medicine,
                TherapeuticClass = t.TherapeuticClass,
                Category = t.Category,
                Posology = t.Posology,
                Duration = t.Duration,
                Date = t.Date,
            })
            .ToListAsync();

        return new ConsultationInterrogatoireResponse
        {
            ConsultationId = consultation.Id,
            PatientId = consultation.PatientId,
            CabinetIdentityId = consultation.CabinetIdentityId,
            ConsultationDate = consultation.ConsultationDate,
            Duration = FormatDuration(consultation.DurationSeconds),
            IsTimerPaused = consultation.IsTimerPaused,
            IsDone = consultation.IsDone,
            Motifs = motifs,
            HistoireMaladie = interrogatoire.HistoireMaladie,
            Diagnostics = NormalizeDiagnostics(interrogatoire.Diagnostics).ToList(),
            CopiedFromPreviousConsultation = false,
            SourceConsultationId = null,
            Anomalies = anomalies,
            OngoingTreatments = treatments
        };
    }

    public async Task<List<InterrogatoireOrdonnanceHistoryResponse>> GetPreviousOrdonnanceHistory(Guid consultationId, Guid cabinetIdentityId)
    {
        var consultation = await db.Consultations
            .AsNoTracking()
            .Where(c => c.Id == consultationId && c.CabinetIdentityId == cabinetIdentityId)
            .Select(c => new { c.PatientId, c.ConsultationDate })
            .FirstOrDefaultAsync()
            ?? throw new InvalidOperationException("Consultation not found.");

        var rows = await db.ConsultationConduiteActions
            .AsNoTracking()
            .Where(item => item.ActionKey == "ordonnance")
            .Join(
                db.Consultations.AsNoTracking().Where(c =>
                    c.CabinetIdentityId == cabinetIdentityId &&
                    c.PatientId == consultation.PatientId &&
                    c.Id != consultationId &&
                    c.ConsultationDate < consultation.ConsultationDate),
                action => action.ConsultationId,
                previous => previous.Id,
                (action, previous) => new
                {
                    previous.Id,
                    previous.ConsultationDate,
                    action.Payload,
                    action.CreatedAt,
                })
            .OrderByDescending(item => item.ConsultationDate)
            .ThenByDescending(item => item.CreatedAt)
            .ToListAsync();

        return rows
            .Select(item => new InterrogatoireOrdonnanceHistoryResponse
            {
                ConsultationId = item.Id,
                ConsultationDate = item.ConsultationDate,
                Payload = ClonePayload(item.Payload),
            })
            .ToList();
    }

    public async Task<List<InterrogatoireAnomalyCatalogItemResponse>> GetAnomalyCatalog(Guid cabinetIdentityId, string? section)
    {
        var normalizedSection = NormalizeSection(section);
        var sectionValue = normalizedSection?.ToString().ToLowerInvariant();

        var hiddenCatalogItems = await db.InterrogatoireAnomalyCatalogHiddens
            .AsNoTracking()
            .Where(item =>
                item.CabinetIdentityId == cabinetIdentityId &&
                (normalizedSection == null || item.Section == normalizedSection.Value))
            .Select(item => new
            {
                Section = item.Section.ToString().ToLowerInvariant(),
                item.CategoryNormalized,
                item.LabelNormalized,
            })
            .ToListAsync();

        var hiddenKeys = hiddenCatalogItems
            .Select(item => BuildCatalogKey(item.Section, item.LabelNormalized, item.CategoryNormalized))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var anomalies = await db.InterrogatoireAnomalies
            .AsNoTracking()
            .Join(
                db.Consultations.AsNoTracking(),
                anomaly => anomaly.ConsultationId,
                consultation => consultation.Id,
                (anomaly, consultation) => new
                {
                    consultation.CabinetIdentityId,
                    anomaly.Section,
                    anomaly.IsCustom,
                    anomaly.TemplateKey,
                    anomaly.Payload,
                    anomaly.CreatedAt,
                })
            .Where(item =>
                item.CabinetIdentityId == cabinetIdentityId &&
                (normalizedSection == null || item.Section == normalizedSection.Value))
            .OrderByDescending(item => item.CreatedAt)
            .ToListAsync();

        var customCatalogItems = await db.InterrogatoireAnomalyCatalogCustoms
            .AsNoTracking()
            .Where(item =>
                item.CabinetIdentityId == cabinetIdentityId &&
                (normalizedSection == null || item.Section == normalizedSection.Value))
            .OrderByDescending(item => item.CreatedAt)
            .Select(item => new InterrogatoireAnomalyCatalogItemResponse
            {
                Section = item.Section.ToString().ToLowerInvariant(),
                IsCustom = item.IsCustom,
                TemplateKey = item.TemplateKey,
                Category = item.Category,
                Label = item.Label,
            })
            .ToListAsync();

        var catalog = new List<InterrogatoireAnomalyCatalogItemResponse>();
        var byKey = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var item in DefaultCatalog)
        {
            if (normalizedSection is not null && item.Section != sectionValue)
            {
                continue;
            }

            var key = BuildCatalogKey(item.Section, item.Label, item.Category);
            if (hiddenKeys.Contains(key))
            {
                continue;
            }

            if (byKey.Add(key))
            {
                catalog.Add(new InterrogatoireAnomalyCatalogItemResponse
                {
                    Section = item.Section,
                    IsCustom = item.IsCustom,
                    TemplateKey = item.TemplateKey,
                    Category = item.Category,
                    Label = item.Label,
                });
            }
        }

        foreach (var item in anomalies)
        {
            var label = PickPayloadLabel(item.Payload, item.TemplateKey);
            if (string.IsNullOrWhiteSpace(label))
            {
                continue;
            }

            var response = new InterrogatoireAnomalyCatalogItemResponse
            {
                Section = item.Section.ToString().ToLowerInvariant(),
                IsCustom = item.IsCustom,
                TemplateKey = item.TemplateKey,
                Category = PickPayloadCategory(item.Payload, item.TemplateKey),
                Label = label,
            };

            var key = BuildCatalogKey(response.Section, response.Label, response.Category);
            if (hiddenKeys.Contains(key))
            {
                continue;
            }

            if (byKey.Add(key))
            {
                catalog.Add(response);
            }
        }

        foreach (var item in customCatalogItems)
        {
            var key = BuildCatalogKey(item.Section, item.Label, item.Category);
            if (hiddenKeys.Contains(key))
            {
                continue;
            }

            if (byKey.Add(key))
            {
                catalog.Add(item);
            }
        }

        return catalog;
    }

    public async Task<InterrogatoireAnomalyCatalogItemResponse> AddCustomAnomalyToCatalog(
        Guid cabinetIdentityId,
        UpsertAnomalyCatalogCustomRequest request)
    {
        var parsedSection = NormalizeSection(request.Section)
            ?? throw new InvalidOperationException($"Unsupported anomaly section '{request.Section}'.");

        var label = request.Label?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(label))
        {
            throw new InvalidOperationException("Label is required.");
        }

        var normalizedLabel = NormalizeCatalogLabel(label);
        var sectionValue = parsedSection.ToString().ToLowerInvariant();
        var templateKey = string.IsNullOrWhiteSpace(request.TemplateKey) ? null : request.TemplateKey.Trim();
        var category = NormalizeCatalogCategoryValue(request.Category);
        var normalizedCategory = NormalizeCatalogLabel(category);

        var isDefaultCatalogItem = DefaultCatalog.Any(item =>
            !item.IsCustom &&
            item.Section == sectionValue &&
            BuildCatalogKey(item.Section, item.Label, item.Category) == BuildCatalogKey(sectionValue, normalizedLabel, normalizedCategory));

        if (isDefaultCatalogItem)
        {
            return new InterrogatoireAnomalyCatalogItemResponse
            {
                Section = sectionValue,
                IsCustom = false,
                TemplateKey = templateKey,
                Category = category,
                Label = label,
            };
        }

        var existing = await db.InterrogatoireAnomalyCatalogCustoms.FirstOrDefaultAsync(item =>
            item.CabinetIdentityId == cabinetIdentityId &&
            item.Section == parsedSection &&
            item.CategoryNormalized == normalizedCategory &&
            item.LabelNormalized == normalizedLabel);

        if (existing is null)
        {
            db.InterrogatoireAnomalyCatalogCustoms.Add(new InterrogatoireAnomalyCatalogCustom
            {
                Id = Guid.NewGuid(),
                CabinetIdentityId = cabinetIdentityId,
                Section = parsedSection,
                IsCustom = true,
                TemplateKey = templateKey,
                Category = category,
                CategoryNormalized = normalizedCategory,
                Label = label,
                LabelNormalized = normalizedLabel,
            });

            try
            {
                await db.SaveChangesAsync();
            }
            catch (DbUpdateException ex) when (ex.InnerException is PostgresException pgEx && pgEx.SqlState == "23505")
            {
                // Concurrent insert; existing row will be used below.
            }

            existing = await db.InterrogatoireAnomalyCatalogCustoms.FirstOrDefaultAsync(item =>
                item.CabinetIdentityId == cabinetIdentityId &&
                item.Section == parsedSection &&
                item.CategoryNormalized == normalizedCategory &&
                item.LabelNormalized == normalizedLabel);
        }

        return new InterrogatoireAnomalyCatalogItemResponse
        {
            Section = sectionValue,
            IsCustom = true,
            TemplateKey = existing?.TemplateKey ?? templateKey,
            Category = existing?.Category ?? category,
            Label = existing?.Label ?? label,
        };
    }

    public async Task HideCustomAnomalyFromCatalog(Guid cabinetIdentityId, string section, string label, string? category = null)
    {
        var parsedSection = NormalizeSection(section)
            ?? throw new InvalidOperationException($"Unsupported anomaly section '{section}'.");

        if (string.IsNullOrWhiteSpace(label))
        {
            throw new InvalidOperationException("Label is required.");
        }

        var originalLabel = label.Trim();
        var normalizedLabel = NormalizeCatalogLabel(originalLabel);
        var sectionValue = parsedSection.ToString().ToLowerInvariant();
        var categoryValue = NormalizeCatalogCategoryValue(category);
        var normalizedCategory = NormalizeCatalogLabel(categoryValue);
        var key = BuildCatalogKey(sectionValue, normalizedLabel, normalizedCategory);

        var isDefaultCatalogItem = DefaultCatalog.Any(item =>
            !item.IsCustom &&
            item.Section == sectionValue &&
            BuildCatalogKey(item.Section, item.Label, item.Category) == key);

        if (isDefaultCatalogItem)
        {
            throw new InvalidOperationException("Default anomalies cannot be removed from catalog.");
        }

        var exists = await db.InterrogatoireAnomalyCatalogHiddens.AnyAsync(item =>
            item.CabinetIdentityId == cabinetIdentityId &&
            item.Section == parsedSection &&
            item.CategoryNormalized == normalizedCategory &&
            item.LabelNormalized == normalizedLabel);

        if (exists)
        {
            return;
        }

        db.InterrogatoireAnomalyCatalogHiddens.Add(new InterrogatoireAnomalyCatalogHidden
        {
            Id = Guid.NewGuid(),
            CabinetIdentityId = cabinetIdentityId,
            Section = parsedSection,
            Category = categoryValue,
            CategoryNormalized = normalizedCategory,
            Label = originalLabel,
            LabelNormalized = normalizedLabel,
        });

        await db.SaveChangesAsync();
    }

    public async Task<List<TreatmentCatalogItemResponse>> GetTreatmentMedicineCatalog(Guid cabinetIdentityId)
    {
        await EnsureGeneralPracticeTreatmentCatalogSeeded(cabinetIdentityId);

        return await BuildTreatmentCatalogResponse(
            cabinetIdentityId,
            db.TreatmentMedicineCatalogItems.AsNoTracking().Where(i => i.CabinetIdentityId == cabinetIdentityId),
            db.OngoingTreatmentMedicines
                .AsNoTracking()
                .Join(db.Consultations.AsNoTracking(), t => t.ConsultationId, c => c.Id, (t, c) => new { t.Medicine, c.CabinetIdentityId })
                .Where(item => item.CabinetIdentityId == cabinetIdentityId)
                .Select(item => item.Medicine));
    }

    public async Task<List<TreatmentCatalogItemResponse>> GetTherapeuticClassCatalog(Guid cabinetIdentityId)
    {
        await EnsureGeneralPracticeTreatmentCatalogSeeded(cabinetIdentityId);

        return await BuildTreatmentCatalogResponse(
            cabinetIdentityId,
            db.TherapeuticClassCatalogItems.AsNoTracking().Where(i => i.CabinetIdentityId == cabinetIdentityId),
            db.OngoingTreatmentMedicines
                .AsNoTracking()
                .Join(db.Consultations.AsNoTracking(), t => t.ConsultationId, c => c.Id, (t, c) => new { t.TherapeuticClass, c.CabinetIdentityId })
                .Where(item => item.CabinetIdentityId == cabinetIdentityId)
                .Select(item => item.TherapeuticClass));
    }

    public async Task<List<TreatmentCatalogItemResponse>> GetTreatmentCategoryCatalog(Guid cabinetIdentityId)
    {
        await EnsureGeneralPracticeTreatmentCatalogSeeded(cabinetIdentityId);

        return await BuildTreatmentCatalogResponse(
            cabinetIdentityId,
            db.TreatmentCategoryCatalogItems.AsNoTracking().Where(i => i.CabinetIdentityId == cabinetIdentityId),
            db.OngoingTreatmentMedicines
                .AsNoTracking()
                .Join(db.Consultations.AsNoTracking(), t => t.ConsultationId, c => c.Id, (t, c) => new { t.Category, c.CabinetIdentityId })
                .Where(item => item.CabinetIdentityId == cabinetIdentityId)
                .Select(item => item.Category));
    }

    public async Task<List<TreatmentCatalogRelationResponse>> GetTreatmentCatalogRelations(Guid cabinetIdentityId)
    {
        await EnsureGeneralPracticeTreatmentCatalogSeeded(cabinetIdentityId);

        var treatmentRows = await db.OngoingTreatmentMedicines
            .AsNoTracking()
            .Join(
                db.Consultations.AsNoTracking(),
                treatment => treatment.ConsultationId,
                consultation => consultation.Id,
                (treatment, consultation) => new
                {
                    consultation.CabinetIdentityId,
                    treatment.TherapeuticClass,
                    treatment.Category,
                    treatment.Medicine,
                })
            .Where(item => item.CabinetIdentityId == cabinetIdentityId)
            .ToListAsync();

        var catalogRows = await db.TreatmentCatalogRelationItems
            .AsNoTracking()
            .Where(item => item.CabinetIdentityId == cabinetIdentityId)
            .Select(item => new
            {
                item.TherapeuticClass,
                item.Category,
                item.Medicine,
            })
            .ToListAsync();

        var byKey = new Dictionary<string, TreatmentCatalogRelationResponse>(StringComparer.OrdinalIgnoreCase);

        foreach (var row in catalogRows)
        {
            AddTreatmentCatalogRelation(byKey, row.TherapeuticClass, row.Category, row.Medicine);
        }

        foreach (var row in treatmentRows)
        {
            AddTreatmentCatalogRelation(byKey, row.TherapeuticClass, row.Category, row.Medicine);
        }

        return byKey.Values
            .OrderBy(item => item.TherapeuticClass)
            .ThenBy(item => item.Category)
            .ThenBy(item => item.Medicine)
            .ToList();
    }

    public async Task<List<string>> GetDiagnosticsCatalog(Guid consultationId, Guid cabinetIdentityId)
    {
        var patientId = await db.Consultations
            .AsNoTracking()
            .Where(c => c.Id == consultationId && c.CabinetIdentityId == cabinetIdentityId)
            .Select(c => (Guid?)c.PatientId)
            .FirstOrDefaultAsync()
            ?? throw new InvalidOperationException("Consultation not found.");

        var diagnosticsRows = await db.Interrogatoires
            .AsNoTracking()
            .Join(
                db.Consultations.AsNoTracking(),
                interrogatoire => interrogatoire.ConsultationId,
                consultation => consultation.Id,
                (interrogatoire, consultation) => new
                {
                    consultation.CabinetIdentityId,
                    consultation.PatientId,
                    interrogatoire.Diagnostics,
                })
            .Where(item =>
                item.CabinetIdentityId == cabinetIdentityId &&
                item.PatientId == patientId)
            .Select(item => item.Diagnostics)
            .ToListAsync();

        return diagnosticsRows
            .SelectMany(item => NormalizeDiagnostics(item))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(item => item, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    public async Task<TreatmentCatalogItemResponse> AddTreatmentMedicineCatalogItem(Guid cabinetIdentityId, UpsertTreatmentCatalogItemRequest request)
    {
        var item = await UpsertTreatmentCatalogItem(
            cabinetIdentityId,
            request,
            db.TreatmentMedicineCatalogItems,
            (entry, label, normalized) =>
            {
                entry.Label = label;
                entry.LabelNormalized = normalized;
            });

        await UpsertTreatmentCatalogRelationItem(
            cabinetIdentityId,
            request.TherapeuticClass,
            request.Category,
            item.Label);

        return item;
    }

    public async Task<TreatmentCatalogItemResponse> AddTherapeuticClassCatalogItem(Guid cabinetIdentityId, UpsertTreatmentCatalogItemRequest request)
    {
        return await UpsertTreatmentCatalogItem(
            cabinetIdentityId,
            request,
            db.TherapeuticClassCatalogItems,
            (entry, label, normalized) =>
            {
                entry.Label = label;
                entry.LabelNormalized = normalized;
            });
    }

    public async Task<TreatmentCatalogItemResponse> AddTreatmentCategoryCatalogItem(Guid cabinetIdentityId, UpsertTreatmentCatalogItemRequest request)
    {
        var item = await UpsertTreatmentCatalogItem(
            cabinetIdentityId,
            request,
            db.TreatmentCategoryCatalogItems,
            (entry, label, normalized) =>
            {
                entry.Label = label;
                entry.LabelNormalized = normalized;
            });

        await UpsertTreatmentCatalogRelationItem(
            cabinetIdentityId,
            request.TherapeuticClass,
            item.Label,
            string.Empty);

        return item;
    }

    public async Task UpdateConsultationTimer(Guid consultationId, UpdateConsultationTimerRequest request, Guid cabinetIdentityId)
    {
        if (request.DurationSeconds < 0)
        {
            throw new InvalidOperationException("DurationSeconds must be greater than or equal to zero.");
        }

        var consultation = await db.Consultations
            .FirstOrDefaultAsync(c => c.Id == consultationId && c.CabinetIdentityId == cabinetIdentityId)
            ?? throw new InvalidOperationException("Consultation not found.");

        if (consultation.IsDone && !request.IsDone)
        {
            throw new InvalidOperationException("This consultation is already finished and cannot be resumed.");
        }

        if (consultation.IsDone && request.IsDone)
        {
            return;
        }

        if (request.IsDone)
        {
            var diagnostics = await db.Interrogatoires
                .AsNoTracking()
                .Where(i => i.ConsultationId == consultationId)
                .Select(i => i.Diagnostics)
                .FirstOrDefaultAsync()
                ?? Array.Empty<string>();

            if (NormalizeDiagnostics(diagnostics).Count == 0)
            {
                throw new InvalidOperationException("At least one diagnostic is required to finish the consultation.");
            }
        }

        consultation.DurationSeconds = request.DurationSeconds;
        consultation.IsDone = request.IsDone;
        consultation.IsTimerPaused = request.IsDone || request.IsTimerPaused;
        await db.SaveChangesAsync();
        await waitingRoomNotifier.NotifyCabinetUpdated(
            cabinetIdentityId,
            consultationId,
            "consultation-timer-updated");
    }

    public async Task UpdateConsultationData(
        Guid consultationId,
        UpdateConsultationDataRequest request,
        Guid cabinetIdentityId,
        bool updateTreatmentCatalog = true)
    {
        var consultation = await db.Consultations
            .FirstOrDefaultAsync(c => c.Id == consultationId && c.CabinetIdentityId == cabinetIdentityId)
            ?? throw new InvalidOperationException("Consultation not found.");

        var interrogatoire = await db.Interrogatoires
            .FirstOrDefaultAsync(i => i.ConsultationId == consultationId)
            ?? throw new InvalidOperationException("Interrogatoire not found.");

        var motifs = NormalizeMotifs(request.Motifs);
        if (motifs.Count == 0)
        {
            throw new InvalidOperationException("At least one motif is required.");
        }

        interrogatoire.HistoireMaladie = NormalizeHistoireMaladie(request.HistoireMaladie);
        interrogatoire.Diagnostics = NormalizeDiagnostics(request.Diagnostics).ToArray();

        var anomalies = (request.Anomalies ?? [])
            .Where(a => a is not null)
            .OrderBy(a => a.SortOrder)
            .Select((a, index) => new InterrogatoireAnomaly
            {
                Id = Guid.NewGuid(),
                ConsultationId = consultationId,
                Section = ParseAnomalySection(a.Section),
                IsCustom = a.IsCustom,
                TemplateKey = string.IsNullOrWhiteSpace(a.TemplateKey) ? null : a.TemplateKey.Trim(),
                SortOrder = index,
                Payload = ClonePayload(a.Payload)
            })
            .ToList();

        var treatments = (request.OngoingTreatments ?? [])
            .Where(t => t is not null)
            .Select(t =>
            {
                var therapeuticClass = NormalizeTreatmentField(t.TherapeuticClass);
                return new OngoingTreatmentMedicine
                {
                    Id = Guid.NewGuid(),
                    ConsultationId = consultationId,
                    Medicine = NormalizeTreatmentField(t.Medicine),
                    TherapeuticClass = therapeuticClass,
                    Category = string.IsNullOrWhiteSpace(therapeuticClass)
                        ? string.Empty
                        : NormalizeTreatmentField(t.Category),
                    Posology = NormalizeTreatmentField(t.Posology),
                    Duration = NormalizeTreatmentField(t.Duration),
                    Date = NormalizeTreatmentField(t.Date),
                };
            })
            .ToList();

        await db.ConsultationMotifs
            .Where(m => m.ConsultationId == consultationId)
            .ExecuteDeleteAsync();

        await db.InterrogatoireAnomalies
            .Where(a => a.ConsultationId == consultationId)
            .ExecuteDeleteAsync();

        await db.OngoingTreatmentMedicines
            .Where(t => t.ConsultationId == consultationId)
            .ExecuteDeleteAsync();

        db.ConsultationMotifs.AddRange(motifs.Select(m => new ConsultationMotif
        {
            Id = Guid.NewGuid(),
            ConsultationId = consultationId,
            Value = m.Original,
            ValueNormalized = m.Normalized
        }));

        if (anomalies.Count > 0)
        {
            db.InterrogatoireAnomalies.AddRange(anomalies);
        }

        if (treatments.Count > 0)
        {
            db.OngoingTreatmentMedicines.AddRange(treatments);
        }

        await db.SaveChangesAsync();

        if (updateTreatmentCatalog)
        {
            foreach (var treatment in treatments)
            {
                await UpsertTreatmentCatalogRelationItem(
                    cabinetIdentityId,
                    treatment.TherapeuticClass,
                    treatment.Category,
                    treatment.Medicine);
            }
        }

        await waitingRoomNotifier.NotifyCabinetUpdated(
            cabinetIdentityId,
            consultationId,
            "consultation-data-updated");
    }

    public async Task DeleteConsultation(Guid consultationId, Guid cabinetIdentityId)
    {
        var deletedCount = await db.Consultations
            .Where(c => c.Id == consultationId && c.CabinetIdentityId == cabinetIdentityId)
            .ExecuteDeleteAsync();

        if (deletedCount == 0)
        {
            throw new InvalidOperationException("Consultation not found.");
        }

        await waitingRoomNotifier.NotifyCabinetUpdated(
            cabinetIdentityId,
            consultationId,
            "consultation-deleted");
    }

    private async Task EnsureGeneralPracticeTreatmentCatalogSeeded(Guid cabinetIdentityId)
    {
        if (IsCabinetCatalogSeeded(cabinetIdentityId))
        {
            return;
        }

        var existingTherapeuticClassKeys = new HashSet<string>(
            (await db.TherapeuticClassCatalogItems
                .AsNoTracking()
                .Where(item => item.CabinetIdentityId == cabinetIdentityId)
                .Select(item => item.Label)
                .ToListAsync())
                .Select(NormalizeCatalogLabel),
            StringComparer.Ordinal);

        var existingCategoryKeys = new HashSet<string>(
            (await db.TreatmentCategoryCatalogItems
                .AsNoTracking()
                .Where(item => item.CabinetIdentityId == cabinetIdentityId)
                .Select(item => item.Label)
                .ToListAsync())
                .Select(NormalizeCatalogLabel),
            StringComparer.Ordinal);

        var existingMedicineKeys = new HashSet<string>(
            (await db.TreatmentMedicineCatalogItems
                .AsNoTracking()
                .Where(item => item.CabinetIdentityId == cabinetIdentityId)
                .Select(item => item.Label)
                .ToListAsync())
                .Select(NormalizeCatalogLabel),
            StringComparer.Ordinal);

        var existingRelationKeys = new HashSet<string>(
            await db.TreatmentCatalogRelationItems
                .AsNoTracking()
                .Where(item => item.CabinetIdentityId == cabinetIdentityId)
                .Select(item => BuildTreatmentCatalogRelationKey(item.TherapeuticClass, item.Category, item.Medicine))
                .ToListAsync(),
            StringComparer.Ordinal);

        var hasChanges = await RemoveDeprecatedTreatmentCatalogDefaults(cabinetIdentityId);

        foreach (var relation in GeneralPracticeCatalogDefaults.TreatmentCatalogRelations)
        {
            var therapeuticClass = NormalizeTreatmentField(relation.TherapeuticClass);
            var category = NormalizeTreatmentField(relation.Category);
            var medicine = NormalizeTreatmentField(relation.Medicine);

            if (string.IsNullOrWhiteSpace(therapeuticClass) ||
                string.IsNullOrWhiteSpace(category) ||
                string.IsNullOrWhiteSpace(medicine))
            {
                continue;
            }

            var therapeuticClassNormalized = NormalizeCatalogLabel(therapeuticClass);
            if (existingTherapeuticClassKeys.Add(therapeuticClassNormalized))
            {
                hasChanges = true;
                db.TherapeuticClassCatalogItems.Add(new TherapeuticClassCatalogItem
                {
                    Id = Guid.NewGuid(),
                    CabinetIdentityId = cabinetIdentityId,
                    Label = therapeuticClass,
                    LabelNormalized = therapeuticClassNormalized,
                });
            }

            var categoryNormalized = NormalizeCatalogLabel(category);
            if (existingCategoryKeys.Add(categoryNormalized))
            {
                hasChanges = true;
                db.TreatmentCategoryCatalogItems.Add(new TreatmentCategoryCatalogItem
                {
                    Id = Guid.NewGuid(),
                    CabinetIdentityId = cabinetIdentityId,
                    Label = category,
                    LabelNormalized = categoryNormalized,
                });
            }

            var medicineNormalized = NormalizeCatalogLabel(medicine);
            if (existingMedicineKeys.Add(medicineNormalized))
            {
                hasChanges = true;
                db.TreatmentMedicineCatalogItems.Add(new TreatmentMedicineCatalogItem
                {
                    Id = Guid.NewGuid(),
                    CabinetIdentityId = cabinetIdentityId,
                    Label = medicine,
                    LabelNormalized = medicineNormalized,
                });
            }

            var relationKey = BuildTreatmentCatalogRelationKey(therapeuticClass, category, medicine);
            if (existingRelationKeys.Add(relationKey))
            {
                hasChanges = true;
                db.TreatmentCatalogRelationItems.Add(new TreatmentCatalogRelationItem
                {
                    Id = Guid.NewGuid(),
                    CabinetIdentityId = cabinetIdentityId,
                    TherapeuticClass = therapeuticClass,
                    TherapeuticClassNormalized = therapeuticClassNormalized,
                    Category = category,
                    CategoryNormalized = categoryNormalized,
                    Medicine = medicine,
                    MedicineNormalized = medicineNormalized,
                });
            }
        }

        if (!hasChanges)
        {
            MarkCabinetCatalogSeeded(cabinetIdentityId);
            return;
        }

        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException pgEx && pgEx.SqlState == "23505")
        {
            // Seeding is idempotent and concurrent-safe; duplicates can happen under concurrent starts.
        }

        MarkCabinetCatalogSeeded(cabinetIdentityId);
    }

    private async Task RefreshGeneralPracticeTreatmentCatalogAccents(Guid cabinetIdentityId)
    {
        var desiredClasses = BuildDesiredTreatmentLabels(relation => relation.TherapeuticClass);
        var desiredCategories = BuildDesiredTreatmentLabels(relation => relation.Category);
        var desiredMedicines = BuildDesiredTreatmentLabels(relation => relation.Medicine);

        var hasChanges = await RemoveDeprecatedTreatmentCatalogDefaults(cabinetIdentityId);
        hasChanges |= await RefreshTreatmentLabelCatalog(
            db.TherapeuticClassCatalogItems,
            cabinetIdentityId,
            desiredClasses,
            (id, label, normalized) => new TherapeuticClassCatalogItem
            {
                Id = id,
                CabinetIdentityId = cabinetIdentityId,
                Label = label,
                LabelNormalized = normalized,
            },
            item => item.Id,
            item => item.Label,
            item => item.LabelNormalized,
            (item, label) => item.Label = label,
            (item, normalized) => item.LabelNormalized = normalized);

        hasChanges |= await RefreshTreatmentLabelCatalog(
            db.TreatmentCategoryCatalogItems,
            cabinetIdentityId,
            desiredCategories,
            (id, label, normalized) => new TreatmentCategoryCatalogItem
            {
                Id = id,
                CabinetIdentityId = cabinetIdentityId,
                Label = label,
                LabelNormalized = normalized,
            },
            item => item.Id,
            item => item.Label,
            item => item.LabelNormalized,
            (item, label) => item.Label = label,
            (item, normalized) => item.LabelNormalized = normalized);

        hasChanges |= await RefreshTreatmentLabelCatalog(
            db.TreatmentMedicineCatalogItems,
            cabinetIdentityId,
            desiredMedicines,
            (id, label, normalized) => new TreatmentMedicineCatalogItem
            {
                Id = id,
                CabinetIdentityId = cabinetIdentityId,
                Label = label,
                LabelNormalized = normalized,
            },
            item => item.Id,
            item => item.Label,
            item => item.LabelNormalized,
            (item, label) => item.Label = label,
            (item, normalized) => item.LabelNormalized = normalized);

        hasChanges |= await RefreshTreatmentCatalogRelations(cabinetIdentityId);

        if (hasChanges)
        {
            await db.SaveChangesAsync();
        }

        MarkCabinetCatalogSeeded(cabinetIdentityId);
    }

    private async Task RefreshStoredDefaultMotifAccents()
    {
        var hasChanges = false;
        var consultationMotifs = await db.ConsultationMotifs.ToListAsync();

        foreach (var motif in consultationMotifs)
        {
            if (!TryGetDefaultMotifLabel(motif.Value, out var accentedMotif))
            {
                continue;
            }

            var normalizedMotif = NormalizeMotifKey(accentedMotif);
            hasChanges |= AssignIfChanged(motif.Value, accentedMotif, value => motif.Value = value);
            hasChanges |= AssignIfChanged(motif.ValueNormalized, normalizedMotif, value => motif.ValueNormalized = value);
        }

        var rdvs = await db.Rdvs
            .Where(rdv => rdv.Motifs != null)
            .ToListAsync();

        foreach (var rdv in rdvs)
        {
            var refreshedMotifs = NormalizeStoredMotifArray(rdv.Motifs);
            if (AreSameMotifs(rdv.Motifs, refreshedMotifs))
            {
                continue;
            }

            rdv.Motifs = refreshedMotifs.Length == 0 ? null : refreshedMotifs;
            hasChanges = true;
        }

        if (hasChanges)
        {
            await db.SaveChangesAsync();
        }
    }

    private static string[] NormalizeStoredMotifArray(string[]? motifs)
    {
        if (motifs is null || motifs.Length == 0)
        {
            return [];
        }

        var byKey = new Dictionary<string, string>(StringComparer.Ordinal);

        foreach (var motif in motifs)
        {
            var trimmed = NormalizeTreatmentField(motif);
            if (string.IsNullOrWhiteSpace(trimmed))
            {
                continue;
            }

            var value = TryGetDefaultMotifLabel(trimmed, out var accentedMotif)
                ? accentedMotif
                : trimmed;
            var key = NormalizeMotifKey(value);
            if (!byKey.ContainsKey(key))
            {
                byKey[key] = value;
            }
        }

        return byKey.Values.ToArray();
    }

    private static bool AreSameMotifs(string[]? left, string[] right)
    {
        if (left is null)
        {
            return right.Length == 0;
        }

        return left.SequenceEqual(right, StringComparer.Ordinal);
    }

    private async Task<bool> RefreshTreatmentLabelCatalog<TCatalog>(
        DbSet<TCatalog> dbSet,
        Guid cabinetIdentityId,
        IReadOnlyDictionary<string, string> desiredLabels,
        Func<Guid, string, string, TCatalog> createItem,
        Func<TCatalog, Guid> getId,
        Func<TCatalog, string> getLabel,
        Func<TCatalog, string> getLabelNormalized,
        Action<TCatalog, string> setLabel,
        Action<TCatalog, string> setLabelNormalized)
        where TCatalog : class
    {
        var rows = await dbSet
            .Where(item => EF.Property<Guid>(item, "CabinetIdentityId") == cabinetIdentityId)
            .ToListAsync();

        var hasChanges = false;

        foreach (var (desiredKey, desiredLabel) in desiredLabels)
        {
            var matches = rows
                .Where(row => IsCatalogLabelMatch(getLabel(row), getLabelNormalized(row), desiredKey))
                .OrderByDescending(row => string.Equals(getLabelNormalized(row), desiredKey, StringComparison.Ordinal))
                .ThenBy(row => row is BaseEntity entity ? entity.CreatedAt : DateTime.MaxValue)
                .ToList();

            if (matches.Count == 0)
            {
                var created = createItem(Guid.NewGuid(), desiredLabel, desiredKey);
                dbSet.Add(created);
                rows.Add(created);
                hasChanges = true;
                continue;
            }

            var survivor = matches[0];
            if (!string.Equals(getLabel(survivor), desiredLabel, StringComparison.Ordinal))
            {
                setLabel(survivor, desiredLabel);
                hasChanges = true;
            }

            if (!string.Equals(getLabelNormalized(survivor), desiredKey, StringComparison.Ordinal))
            {
                setLabelNormalized(survivor, desiredKey);
                hasChanges = true;
            }

            foreach (var duplicate in matches.Skip(1))
            {
                dbSet.Remove(duplicate);
                rows.Remove(duplicate);
                hasChanges = true;
            }
        }

        return hasChanges;
    }

    private async Task<bool> RemoveDeprecatedTreatmentCatalogDefaults(Guid cabinetIdentityId)
    {
        var desiredClassKeys = BuildDesiredTreatmentLabels(relation => relation.TherapeuticClass)
            .Keys
            .ToHashSet(StringComparer.Ordinal);
        var desiredCategoryKeys = BuildDesiredTreatmentLabels(relation => relation.Category)
            .Keys
            .ToHashSet(StringComparer.Ordinal);
        var desiredMedicineKeys = BuildDesiredTreatmentLabels(relation => relation.Medicine)
            .Keys
            .ToHashSet(StringComparer.Ordinal);

        var deprecatedClassKeys = BuildDeprecatedTreatmentLabels(relation => relation.TherapeuticClass)
            .Keys
            .Where(key => !desiredClassKeys.Contains(key))
            .ToHashSet(StringComparer.Ordinal);
        var deprecatedCategoryKeys = BuildDeprecatedTreatmentLabels(relation => relation.Category)
            .Keys
            .Where(key => !desiredCategoryKeys.Contains(key))
            .ToHashSet(StringComparer.Ordinal);
        var deprecatedMedicineKeys = BuildDeprecatedTreatmentLabels(relation => relation.Medicine)
            .Keys
            .Where(key => !desiredMedicineKeys.Contains(key))
            .ToHashSet(StringComparer.Ordinal);
        var deprecatedRelationKeys = GeneralPracticeCatalogDefaults.DeprecatedTreatmentCatalogRelations
            .Select(relation => new TreatmentCatalogRelationSeedValues(
                NormalizeTreatmentField(relation.TherapeuticClass),
                NormalizeTreatmentField(relation.Category),
                NormalizeTreatmentField(relation.Medicine)))
            .Select(relation => BuildTreatmentCatalogRelationKey(
                relation.TherapeuticClass,
                relation.Category,
                relation.Medicine))
            .ToHashSet(StringComparer.Ordinal);

        var hasChanges = false;

        if (deprecatedRelationKeys.Count > 0)
        {
            var relationRows = await db.TreatmentCatalogRelationItems
                .Where(item => item.CabinetIdentityId == cabinetIdentityId)
                .ToListAsync();

            foreach (var row in relationRows.Where(row => IsTreatmentCatalogRelationMatchAny(row, deprecatedRelationKeys)))
            {
                db.TreatmentCatalogRelationItems.Remove(row);
                hasChanges = true;
            }
        }

        if (deprecatedClassKeys.Count > 0)
        {
            var classRows = await db.TherapeuticClassCatalogItems
                .Where(item => item.CabinetIdentityId == cabinetIdentityId)
                .ToListAsync();

            foreach (var row in classRows.Where(row => IsCatalogLabelMatchAny(row.Label, row.LabelNormalized, deprecatedClassKeys)))
            {
                db.TherapeuticClassCatalogItems.Remove(row);
                hasChanges = true;
            }
        }

        if (deprecatedCategoryKeys.Count > 0)
        {
            var categoryRows = await db.TreatmentCategoryCatalogItems
                .Where(item => item.CabinetIdentityId == cabinetIdentityId)
                .ToListAsync();

            foreach (var row in categoryRows.Where(row => IsCatalogLabelMatchAny(row.Label, row.LabelNormalized, deprecatedCategoryKeys)))
            {
                db.TreatmentCategoryCatalogItems.Remove(row);
                hasChanges = true;
            }
        }

        if (deprecatedMedicineKeys.Count > 0)
        {
            var medicineRows = await db.TreatmentMedicineCatalogItems
                .Where(item => item.CabinetIdentityId == cabinetIdentityId)
                .ToListAsync();

            foreach (var row in medicineRows.Where(row => IsCatalogLabelMatchAny(row.Label, row.LabelNormalized, deprecatedMedicineKeys)))
            {
                db.TreatmentMedicineCatalogItems.Remove(row);
                hasChanges = true;
            }
        }

        return hasChanges;
    }

    private async Task<bool> RefreshTreatmentCatalogRelations(Guid cabinetIdentityId)
    {
        var desiredRelations = GeneralPracticeCatalogDefaults.TreatmentCatalogRelations
            .Select(relation => new TreatmentCatalogRelationSeedValues(
                NormalizeTreatmentField(relation.TherapeuticClass),
                NormalizeTreatmentField(relation.Category),
                NormalizeTreatmentField(relation.Medicine)))
            .Where(relation =>
                !string.IsNullOrWhiteSpace(relation.TherapeuticClass) ||
                !string.IsNullOrWhiteSpace(relation.Category) ||
                !string.IsNullOrWhiteSpace(relation.Medicine))
            .GroupBy(relation => BuildTreatmentCatalogRelationKey(
                relation.TherapeuticClass,
                relation.Category,
                relation.Medicine))
            .Select(group => group.First())
            .ToList();

        var rows = await db.TreatmentCatalogRelationItems
            .Where(item => item.CabinetIdentityId == cabinetIdentityId)
            .ToListAsync();

        var hasChanges = false;

        foreach (var desired in desiredRelations)
        {
            var desiredClassNormalized = NormalizeCatalogLabel(desired.TherapeuticClass);
            var desiredCategoryNormalized = NormalizeCatalogLabel(desired.Category);
            var desiredMedicineNormalized = NormalizeCatalogLabel(desired.Medicine);
            var desiredKey = BuildTreatmentCatalogRelationKey(
                desired.TherapeuticClass,
                desired.Category,
                desired.Medicine);

            var matches = rows
                .Where(row => IsTreatmentCatalogRelationMatch(row, desiredKey))
                .OrderByDescending(row =>
                    string.Equals(row.TherapeuticClassNormalized, desiredClassNormalized, StringComparison.Ordinal) &&
                    string.Equals(row.CategoryNormalized, desiredCategoryNormalized, StringComparison.Ordinal) &&
                    string.Equals(row.MedicineNormalized, desiredMedicineNormalized, StringComparison.Ordinal))
                .ThenBy(row => row.CreatedAt)
                .ToList();

            if (matches.Count == 0)
            {
                db.TreatmentCatalogRelationItems.Add(new TreatmentCatalogRelationItem
                {
                    Id = Guid.NewGuid(),
                    CabinetIdentityId = cabinetIdentityId,
                    TherapeuticClass = desired.TherapeuticClass,
                    TherapeuticClassNormalized = desiredClassNormalized,
                    Category = desired.Category,
                    CategoryNormalized = desiredCategoryNormalized,
                    Medicine = desired.Medicine,
                    MedicineNormalized = desiredMedicineNormalized,
                });
                hasChanges = true;
                continue;
            }

            var survivor = matches[0];
            hasChanges |= AssignIfChanged(
                survivor.TherapeuticClass,
                desired.TherapeuticClass,
                value => survivor.TherapeuticClass = value);
            hasChanges |= AssignIfChanged(
                survivor.TherapeuticClassNormalized,
                desiredClassNormalized,
                value => survivor.TherapeuticClassNormalized = value);
            hasChanges |= AssignIfChanged(
                survivor.Category,
                desired.Category,
                value => survivor.Category = value);
            hasChanges |= AssignIfChanged(
                survivor.CategoryNormalized,
                desiredCategoryNormalized,
                value => survivor.CategoryNormalized = value);
            hasChanges |= AssignIfChanged(
                survivor.Medicine,
                desired.Medicine,
                value => survivor.Medicine = value);
            hasChanges |= AssignIfChanged(
                survivor.MedicineNormalized,
                desiredMedicineNormalized,
                value => survivor.MedicineNormalized = value);

            foreach (var duplicate in matches.Skip(1))
            {
                db.TreatmentCatalogRelationItems.Remove(duplicate);
                rows.Remove(duplicate);
                hasChanges = true;
            }
        }

        return hasChanges;
    }

    private static Dictionary<string, string> BuildDesiredTreatmentLabels(
        Func<GeneralPracticeCatalogDefaults.TreatmentCatalogRelationSeed, string> selector)
    {
        return BuildTreatmentLabels(GeneralPracticeCatalogDefaults.TreatmentCatalogRelations, selector);
    }

    private static Dictionary<string, string> BuildDeprecatedTreatmentLabels(
        Func<GeneralPracticeCatalogDefaults.TreatmentCatalogRelationSeed, string> selector)
    {
        return BuildTreatmentLabels(GeneralPracticeCatalogDefaults.DeprecatedTreatmentCatalogRelations, selector);
    }

    private static Dictionary<string, string> BuildTreatmentLabels(
        IEnumerable<GeneralPracticeCatalogDefaults.TreatmentCatalogRelationSeed> relations,
        Func<GeneralPracticeCatalogDefaults.TreatmentCatalogRelationSeed, string> selector)
    {
        var labels = new Dictionary<string, string>(StringComparer.Ordinal);

        foreach (var relation in relations)
        {
            var label = NormalizeTreatmentField(selector(relation));
            var normalized = NormalizeCatalogLabel(label);
            if (string.IsNullOrWhiteSpace(normalized) || labels.ContainsKey(normalized))
            {
                continue;
            }

            labels[normalized] = label;
        }

        return labels;
    }

    private static bool IsCatalogLabelMatch(string label, string labelNormalized, string desiredKey)
    {
        return string.Equals(NormalizeCatalogLabel(label), desiredKey, StringComparison.Ordinal) ||
            string.Equals(NormalizeCatalogLabel(labelNormalized), desiredKey, StringComparison.Ordinal);
    }

    private static bool IsCatalogLabelMatchAny(string label, string labelNormalized, IReadOnlySet<string> desiredKeys)
    {
        return desiredKeys.Contains(NormalizeCatalogLabel(label)) ||
            desiredKeys.Contains(NormalizeCatalogLabel(labelNormalized));
    }

    private static bool IsTreatmentCatalogRelationMatch(TreatmentCatalogRelationItem row, string desiredKey)
    {
        var labelKey = BuildTreatmentCatalogRelationKey(row.TherapeuticClass, row.Category, row.Medicine);
        if (string.Equals(labelKey, desiredKey, StringComparison.Ordinal))
        {
            return true;
        }

        var normalizedKey = BuildTreatmentCatalogRelationKey(
            row.TherapeuticClassNormalized,
            row.CategoryNormalized,
            row.MedicineNormalized);

        return string.Equals(normalizedKey, desiredKey, StringComparison.Ordinal);
    }

    private static bool IsTreatmentCatalogRelationMatchAny(TreatmentCatalogRelationItem row, IReadOnlySet<string> desiredKeys)
    {
        var labelKey = BuildTreatmentCatalogRelationKey(row.TherapeuticClass, row.Category, row.Medicine);
        if (desiredKeys.Contains(labelKey))
        {
            return true;
        }

        var normalizedKey = BuildTreatmentCatalogRelationKey(
            row.TherapeuticClassNormalized,
            row.CategoryNormalized,
            row.MedicineNormalized);

        return desiredKeys.Contains(normalizedKey);
    }

    private static bool AssignIfChanged(string current, string next, Action<string> assign)
    {
        if (string.Equals(current, next, StringComparison.Ordinal))
        {
            return false;
        }

        assign(next);
        return true;
    }

    private static bool TryGetDefaultMotifLabel(string value, out string label)
    {
        return DefaultMotifLabelsByKey.TryGetValue(NormalizeMotifKey(value), out label!);
    }

    private sealed record TreatmentCatalogRelationSeedValues(
        string TherapeuticClass,
        string Category,
        string Medicine);

    private static bool IsCabinetCatalogSeeded(Guid cabinetIdentityId)
    {
        lock (SeededCatalogCabinetsLock)
        {
            return SeededCatalogCabinets.Contains(cabinetIdentityId);
        }
    }

    private static void MarkCabinetCatalogSeeded(Guid cabinetIdentityId)
    {
        lock (SeededCatalogCabinetsLock)
        {
            SeededCatalogCabinets.Add(cabinetIdentityId);
        }
    }

    private static InterrogatoireAnomalyResponse MapAnomaly(InterrogatoireAnomaly anomaly)
    {
        return new InterrogatoireAnomalyResponse
        {
            Id = anomaly.Id,
            Section = anomaly.Section.ToString().ToLowerInvariant(),
            IsCustom = anomaly.IsCustom,
            TemplateKey = anomaly.TemplateKey,
            SortOrder = anomaly.SortOrder,
            Payload = anomaly.Payload
        };
    }

    private static OngoingTreatmentMedicineResponse MapTreatment(OngoingTreatmentMedicine treatment)
    {
        return new OngoingTreatmentMedicineResponse
        {
            Id = treatment.Id,
            Medicine = treatment.Medicine,
            TherapeuticClass = treatment.TherapeuticClass,
            Category = treatment.Category,
            Posology = treatment.Posology,
            Duration = treatment.Duration,
            Date = treatment.Date,
        };
    }

    private static void AddTreatmentCatalogRelation(
        IDictionary<string, TreatmentCatalogRelationResponse> byKey,
        string? therapeuticClassRaw,
        string? categoryRaw,
        string? medicineRaw)
    {
        var therapeuticClass = NormalizeTreatmentField(therapeuticClassRaw);
        var category = NormalizeTreatmentField(categoryRaw);
        var medicine = NormalizeTreatmentField(medicineRaw);

        if (string.IsNullOrWhiteSpace(therapeuticClass))
        {
            category = string.Empty;
        }

        if (string.IsNullOrWhiteSpace(therapeuticClass) && string.IsNullOrWhiteSpace(category) && string.IsNullOrWhiteSpace(medicine))
        {
            return;
        }

        var key = BuildTreatmentCatalogRelationKey(therapeuticClass, category, medicine);
        if (byKey.ContainsKey(key))
        {
            return;
        }

        byKey[key] = new TreatmentCatalogRelationResponse
        {
            TherapeuticClass = therapeuticClass,
            Category = category,
            Medicine = medicine,
        };
    }

    private async Task UpsertTreatmentCatalogRelationItem(
        Guid cabinetIdentityId,
        string? therapeuticClassRaw,
        string? categoryRaw,
        string? medicineRaw)
    {
        var therapeuticClass = NormalizeTreatmentField(therapeuticClassRaw);
        var category = NormalizeTreatmentField(categoryRaw);
        var medicine = NormalizeTreatmentField(medicineRaw);

        if (string.IsNullOrWhiteSpace(therapeuticClass))
        {
            category = string.Empty;
        }

        if (string.IsNullOrWhiteSpace(therapeuticClass) && string.IsNullOrWhiteSpace(category) && string.IsNullOrWhiteSpace(medicine))
        {
            return;
        }

        var therapeuticClassNormalized = NormalizeCatalogLabel(therapeuticClass);
        var categoryNormalized = NormalizeCatalogLabel(category);
        var medicineNormalized = NormalizeCatalogLabel(medicine);

        var exists = await db.TreatmentCatalogRelationItems.AnyAsync(item =>
            item.CabinetIdentityId == cabinetIdentityId &&
            item.TherapeuticClassNormalized == therapeuticClassNormalized &&
            item.CategoryNormalized == categoryNormalized &&
            item.MedicineNormalized == medicineNormalized);

        if (exists)
        {
            return;
        }

        db.TreatmentCatalogRelationItems.Add(new TreatmentCatalogRelationItem
        {
            Id = Guid.NewGuid(),
            CabinetIdentityId = cabinetIdentityId,
            TherapeuticClass = therapeuticClass,
            TherapeuticClassNormalized = therapeuticClassNormalized,
            Category = category,
            CategoryNormalized = categoryNormalized,
            Medicine = medicine,
            MedicineNormalized = medicineNormalized,
        });

        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException pgEx && pgEx.SqlState == "23505")
        {
            // Concurrent request inserted same relation.
        }
    }

    private static string BuildTreatmentCatalogRelationKey(string therapeuticClass, string category, string medicine)
    {
        return $"{NormalizeCatalogLabel(therapeuticClass)}::{NormalizeCatalogLabel(category)}::{NormalizeCatalogLabel(medicine)}";
    }

    private static string NormalizeTreatmentField(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        return string.Join(' ', value.Trim().Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
    }

    private static string NormalizeHistoireMaladie(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        return value.Replace("\r\n", "\n").Trim();
    }

    private static IReadOnlyList<string> NormalizeDiagnostics(IEnumerable<string>? diagnostics)
    {
        if (diagnostics is null)
        {
            return [];
        }

        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var result = new List<string>();

        foreach (var rawDiagnostic in diagnostics)
        {
            var normalized = NormalizeDiagnostic(rawDiagnostic);
            if (string.IsNullOrWhiteSpace(normalized) || !seen.Add(normalized))
            {
                continue;
            }

            result.Add(normalized);
        }

        return result;
    }

    private static string NormalizeDiagnostic(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        var normalized = string.Join(' ', value.Trim().Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        if (normalized.StartsWith("add item ", StringComparison.OrdinalIgnoreCase))
        {
            normalized = normalized[9..].Trim();
        }

        if (normalized.Length >= 2 &&
            ((normalized.StartsWith('"') && normalized.EndsWith('"')) ||
            (normalized.StartsWith('\'') && normalized.EndsWith('\''))))
        {
            normalized = normalized[1..^1].Trim();
        }
        else if (normalized.StartsWith('"') || normalized.StartsWith('\''))
        {
            normalized = normalized[1..].Trim();
        }

        return normalized;
    }

    private async Task<List<TreatmentCatalogItemResponse>> BuildTreatmentCatalogResponse<TCatalog>(
        Guid cabinetIdentityId,
        IQueryable<TCatalog> explicitCatalog,
        IQueryable<string?> valuesFromConsultations)
        where TCatalog : class
    {
        var explicitItems = await explicitCatalog
            .Select(item => new TreatmentCatalogItemResponse
            {
                Id = EF.Property<Guid>(item, "Id"),
                Label = EF.Property<string>(item, "Label")
            })
            .ToListAsync();

        var consultationValues = await valuesFromConsultations
            .Where(value => value != null && value.Trim() != string.Empty)
            .ToListAsync();

        var byNormalized = new Dictionary<string, TreatmentCatalogItemResponse>(StringComparer.OrdinalIgnoreCase);

        foreach (var item in explicitItems)
        {
            var normalized = NormalizeCatalogLabel(item.Label);
            if (!byNormalized.ContainsKey(normalized))
            {
                byNormalized[normalized] = item;
            }
        }

        foreach (var raw in consultationValues)
        {
            var label = NormalizeTreatmentField(raw);
            if (string.IsNullOrWhiteSpace(label))
            {
                continue;
            }

            var normalized = NormalizeCatalogLabel(label);
            if (!byNormalized.ContainsKey(normalized))
            {
                byNormalized[normalized] = new TreatmentCatalogItemResponse
                {
                    Id = Guid.Empty,
                    Label = label,
                };
            }
        }

        return byNormalized.Values
            .OrderBy(item => item.Label)
            .ToList();
    }

    private async Task<TreatmentCatalogItemResponse> UpsertTreatmentCatalogItem<TEntity>(
        Guid cabinetIdentityId,
        UpsertTreatmentCatalogItemRequest request,
        DbSet<TEntity> dbSet,
        Action<TEntity, string, string> assign)
        where TEntity : class, new()
    {
        var label = NormalizeTreatmentField(request.Label);
        if (string.IsNullOrWhiteSpace(label))
        {
            throw new InvalidOperationException("Label is required.");
        }

        var normalized = NormalizeCatalogLabel(label);

        var existing = await dbSet.FirstOrDefaultAsync(item =>
            EF.Property<Guid>(item, "CabinetIdentityId") == cabinetIdentityId &&
            EF.Property<string>(item, "LabelNormalized") == normalized);

        if (existing is null)
        {
            existing = new TEntity();
            typeof(TEntity).GetProperty("Id")?.SetValue(existing, Guid.NewGuid());
            typeof(TEntity).GetProperty("CabinetIdentityId")?.SetValue(existing, cabinetIdentityId);
            assign(existing, label, normalized);
            dbSet.Add(existing);
            try
            {
                await db.SaveChangesAsync();
            }
            catch (DbUpdateException ex) when (ex.InnerException is PostgresException pgEx && pgEx.SqlState == "23505")
            {
                existing = await dbSet.FirstOrDefaultAsync(item =>
                    EF.Property<Guid>(item, "CabinetIdentityId") == cabinetIdentityId &&
                    EF.Property<string>(item, "LabelNormalized") == normalized);

                if (existing is null)
                {
                    throw;
                }
            }
        }

        if (existing is null)
        {
            throw new InvalidOperationException("Unable to upsert treatment catalog item.");
        }

        return new TreatmentCatalogItemResponse
        {
            Id = ReadEntityGuidProperty(existing, "Id"),
            Label = NormalizeTreatmentField(ReadEntityStringProperty(existing, "Label")),
        };
    }

    private static Guid ReadEntityGuidProperty<TEntity>(TEntity entity, string propertyName)
    {
        var value = typeof(TEntity).GetProperty(propertyName)?.GetValue(entity);
        return value is Guid id ? id : Guid.Empty;
    }

    private static string ReadEntityStringProperty<TEntity>(TEntity entity, string propertyName)
    {
        var value = typeof(TEntity).GetProperty(propertyName)?.GetValue(entity);
        return value as string ?? string.Empty;
    }

    private static InterrogatoireAnomalySection? NormalizeSection(string? section)
    {
        if (string.IsNullOrWhiteSpace(section))
        {
            return null;
        }

        return section.Trim().ToLowerInvariant() switch
        {
            "medical" => InterrogatoireAnomalySection.Medical,
            "family" => InterrogatoireAnomalySection.Family,
            "surgical" => InterrogatoireAnomalySection.Surgical,
            _ => null,
        };
    }

    private static string PickPayloadLabel(Dictionary<string, JsonElement> payload, string? templateKey)
    {
        if (payload.TryGetValue("name", out var nameEl) && nameEl.ValueKind == JsonValueKind.String)
        {
            var value = nameEl.GetString()?.Trim();
            if (!string.IsNullOrWhiteSpace(value))
            {
                return value;
            }
        }

        if (payload.TryGetValue("label", out var labelEl) && labelEl.ValueKind == JsonValueKind.String)
        {
            var value = labelEl.GetString()?.Trim();
            if (!string.IsNullOrWhiteSpace(value))
            {
                return value;
            }
        }

        return string.IsNullOrWhiteSpace(templateKey) ? string.Empty : templateKey.Trim();
    }

    private static string PickPayloadCategory(Dictionary<string, JsonElement> payload, string? templateKey)
    {
        foreach (var key in new[] { "category", "categoryKey", "typeCategory" })
        {
            if (payload.TryGetValue(key, out var categoryEl) && categoryEl.ValueKind == JsonValueKind.String)
            {
                var value = NormalizeCatalogCategoryValue(categoryEl.GetString());
                if (!string.IsNullOrWhiteSpace(value))
                {
                    return value;
                }
            }
        }

        var normalizedTemplateKey = templateKey?.Trim().ToLowerInvariant() ?? string.Empty;
        if (normalizedTemplateKey.StartsWith("dermatologic-antecedent-laser-", StringComparison.Ordinal))
        {
            return "laser";
        }

        if (normalizedTemplateKey.StartsWith("dermatologic-antecedent-surgical-", StringComparison.Ordinal))
        {
            return "surgical";
        }

        if (normalizedTemplateKey.StartsWith("dermatologic-antecedent-general-", StringComparison.Ordinal))
        {
            return "general";
        }

        return string.Empty;
    }

    private static string BuildCatalogKey(string section, string label, string? category = null)
    {
        var normalizedSection = section.Trim().ToLowerInvariant();
        var normalizedCategory = NormalizeCatalogLabel(category ?? string.Empty);
        var normalizedLabel = NormalizeCatalogLabel(label);
        return $"{normalizedSection}::{normalizedCategory}::{normalizedLabel}";
    }

    private static string NormalizeCatalogCategoryValue(string? category)
    {
        var normalized = NormalizeCatalogLabel(category ?? string.Empty);
        return normalized switch
        {
            "laser" => "laser",
            "traitement laser" => "laser",
            "antecedents de traitement par laser" => "laser",
            "surgical" => "surgical",
            "surgery" => "surgical",
            "chirurgical" => "surgical",
            "chirurgicaux" => "surgical",
            "chirurgie" => "surgical",
            "general" => "general",
            "generaux" => "general",
            "dermatologiques generaux" => "general",
            "antecedents dermatologiques generaux" => "general",
            _ => normalized,
        };
    }

    private static string NormalizeCatalogLabel(string label)
    {
        var compact = string.Join(' ', label.Trim().Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        if (string.IsNullOrWhiteSpace(compact))
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

            builder.Append(ch is '\'' or '’' or '`' ? ' ' : ch);
        }

        return string.Join(
            ' ',
            builder
                .ToString()
                .Normalize(NormalizationForm.FormC)
                .Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
    }

    private static Dictionary<string, JsonElement> ClonePayload(Dictionary<string, JsonElement>? payload)
    {
        if (payload is null || payload.Count == 0) return [];

        var clone = new Dictionary<string, JsonElement>(payload.Count, StringComparer.Ordinal);
        foreach (var item in payload)
        {
            using var doc = JsonDocument.Parse(item.Value.GetRawText());
            clone[item.Key] = doc.RootElement.Clone();
        }

        return clone;
    }

    private static List<(string Original, string Normalized)> NormalizeMotifs(List<string>? motifs)
    {
        if (motifs is null || motifs.Count == 0) return [];

        var seen = new HashSet<string>(StringComparer.Ordinal);
        var normalizedMotifs = new List<(string Original, string Normalized)>();

        foreach (var motif in motifs)
        {
            if (string.IsNullOrWhiteSpace(motif)) continue;
            var original = motif.Trim();
            var normalized = NormalizeMotifKey(original);
            if (!seen.Add(normalized)) continue;

            normalizedMotifs.Add((original, normalized));
        }

        return normalizedMotifs;
    }

    private static string NormalizeMotifKey(string value)
    {
        var compact = string.Join(' ', value.Trim().Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        if (string.IsNullOrWhiteSpace(compact))
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

    private static string FormatDuration(int durationSeconds)
    {
        var safeDurationSeconds = Math.Max(0, durationSeconds);
        var duration = TimeSpan.FromSeconds(safeDurationSeconds);

        if (duration < TimeSpan.Zero)
        {
            duration = TimeSpan.Zero;
        }

        return duration.ToString(@"hh\:mm\:ss");
    }

    private static InterrogatoireAnomalySection ParseAnomalySection(string? rawSection)
    {
        return rawSection?.Trim().ToLowerInvariant() switch
        {
            "medical" => InterrogatoireAnomalySection.Medical,
            "family" => InterrogatoireAnomalySection.Family,
            "surgical" => InterrogatoireAnomalySection.Surgical,
            _ => throw new InvalidOperationException($"Unsupported anomaly section '{rawSection}'.")
        };
    }
}
