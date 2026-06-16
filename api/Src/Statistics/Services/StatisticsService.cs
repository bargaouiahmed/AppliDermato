using System.Text.Json;
using api.Src.ConsultationSpace.ConduiteSection;
using api.Src.ConsultationSpace.Entities;
using api.Src.PatientSpace.Entities;
using api.Src.Statistics.Dtos;
using Microsoft.EntityFrameworkCore;

namespace api.Src.Statistics.Services;

public class StatisticsService(AppDbContext db) : IStatisticsService
{
    private const int MaxPatientPageSize = 100;

    private static readonly (string Key, string Label, int? MinAge, int? MaxAge)[] AgeGroups =
    [
        ("children", "0-12 ans", 0, 12),
        ("teenagers", "13-17 ans", 13, 17),
        ("young_adults", "18-39 ans", 18, 39),
        ("adults", "40-64 ans", 40, 64),
        ("seniors", "65+ ans", 65, null),
    ];

    public async Task<List<string>> GetDiagnosticsCatalog(Guid cabinetIdentityId)
    {
        var diagnostics = await db.Interrogatoires
            .AsNoTracking()
            .Where(i => i.Consultation.CabinetIdentityId == cabinetIdentityId && i.Diagnostics.Length > 0)
            .SelectMany(i => i.Diagnostics)
            .Where(d => d != null && d.Trim() != string.Empty)
            .Select(d => d.Trim())
            .ToListAsync();

        return diagnostics
            .GroupBy(d => d, StringComparer.OrdinalIgnoreCase)
            .Select(g => g.First())
            .OrderBy(d => d)
            .ToList();
    }

    public async Task<StatisticsOverviewResponse> GetOverview(Guid cabinetIdentityId, StatisticsOverviewRequest request)
    {
        var today = DateTime.UtcNow.Date;
        var selectedDiagnostics = NormalizeDiagnostics(request);
        var dateRange = ResolveDateRange(request, today);
        var pageNumber = Math.Max(1, request.PageNumber);
        var pageSize = Math.Clamp(request.PageSize <= 0 ? 10 : request.PageSize, 1, MaxPatientPageSize);

        var patientLevelQuery = ApplyPatientLevelFilters(
            db.Patients.AsNoTracking().Where(p => p.CabinetIdentityId == cabinetIdentityId),
            request,
            today);

        var patientStatisticsQuery = ApplyDiagnosticPatientFilter(
            patientLevelQuery,
            cabinetIdentityId,
            selectedDiagnostics);

        var consultationQuery = db.Consultations
            .AsNoTracking()
            .Where(c => c.CabinetIdentityId == cabinetIdentityId);

        if (HasPatientLevelFilters(request))
        {
            var patientLevelIds = patientLevelQuery.Select(p => p.Id);
            consultationQuery = consultationQuery.Where(c => patientLevelIds.Contains(c.PatientId));
        }

        consultationQuery = ApplyConsultationScopeFilters(consultationQuery, dateRange, selectedDiagnostics);

        var consultationStatistics = await BuildConsultationStatistics(consultationQuery, dateRange);
        var patientStatistics = await BuildPatientStatistics(
            patientStatisticsQuery,
            cabinetIdentityId,
            selectedDiagnostics,
            today,
            pageNumber,
            pageSize);

        return new StatisticsOverviewResponse
        {
            ConsultationStatistics = consultationStatistics,
            PatientStatistics = patientStatistics,
        };
    }

    private async Task<StatisticsConsultationSectionResponse> BuildConsultationStatistics(
        IQueryable<Consultation> consultationQuery,
        StatisticsDateRange dateRange)
    {
        var summary = await consultationQuery
            .GroupBy(_ => 1)
            .Select(g => new
            {
                TotalConsultations = g.Count(),
                CompletedConsultations = g.Count(c => c.IsDone),
                NotCompletedConsultations = g.Count(c => !c.IsDone),
                AverageDurationSeconds = g.Average(c => (double?)c.DurationSeconds),
            })
            .FirstOrDefaultAsync();

        var totalConsultations = summary?.TotalConsultations ?? 0;
        var averageDurationSeconds = (int)Math.Round(summary?.AverageDurationSeconds ?? 0);

        var timeline = await BuildTimelineBuckets(consultationQuery, dateRange);

        var diagnosticFrequency = await consultationQuery
            .Where(c => c.Interrogatoire.Diagnostics.Length > 0)
            .SelectMany(c => c.Interrogatoire.Diagnostics)
            .Where(d => d != null && d.Trim() != string.Empty)
            .GroupBy(d => d.Trim())
            .OrderByDescending(g => g.Count())
            .ThenBy(g => g.Key)
            .Take(12)
            .Select(g => new StatisticsBucketResponse
            {
                Label = g.Key,
                Count = g.Count(),
            })
            .ToListAsync();
        ApplyPercentages(diagnosticFrequency, totalConsultations);

        var consultationIds = consultationQuery.Select(c => c.Id);
        var cnamActions = await db.ConsultationConduiteActions
            .AsNoTracking()
            .Where(a => a.ActionKey == ConduiteActionKeys.Cnam && consultationIds.Contains(a.ConsultationId))
            .Select(a => a.Payload)
            .ToListAsync();

        var cnamForms = BuildCnamFormDistribution(cnamActions);
        ApplyPercentages(cnamForms, cnamActions.Count);

        return new StatisticsConsultationSectionResponse
        {
            Period = dateRange.Period,
            ChartGranularity = dateRange.ChartGranularity,
            StartDate = dateRange.Start,
            EndDate = dateRange.EndExclusive?.AddDays(-1),
            Timeline = timeline,
            TotalConsultations = totalConsultations,
            CompletedConsultations = summary?.CompletedConsultations ?? 0,
            NotCompletedConsultations = summary?.NotCompletedConsultations ?? 0,
            AverageDurationSeconds = averageDurationSeconds,
            AverageDuration = FormatDuration(averageDurationSeconds),
            DiagnosticFrequency = diagnosticFrequency,
            CnamForms = cnamForms,
        };
    }

    private async Task<StatisticsPatientSectionResponse> BuildPatientStatistics(
        IQueryable<Patient> patientQuery,
        Guid cabinetIdentityId,
        IReadOnlyCollection<string> selectedDiagnostics,
        DateTime today,
        int pageNumber,
        int pageSize)
    {
        var totalPatients = await patientQuery.CountAsync();

        var patientsWithAnyDiagnosisIds = db.Consultations
            .AsNoTracking()
            .Where(c =>
                c.CabinetIdentityId == cabinetIdentityId &&
                c.Interrogatoire.Diagnostics.Any(d => d != null && d.Trim() != string.Empty))
            .Select(c => c.PatientId)
            .Distinct();

        var patientsWithDiagnostics = await patientQuery
            .Where(p => patientsWithAnyDiagnosisIds.Contains(p.Id))
            .CountAsync();

        var cnamCoverage = await BuildCnamCoverage(patientQuery, totalPatients);
        var sexDistribution = await BuildSexDistribution(patientQuery, totalPatients);

        var birthDates = await patientQuery
            .Select(p => p.DateOfBirth)
            .ToListAsync();
        var ageGroupDistribution = BuildAgeGroupDistribution(birthDates, today);
        ApplyPercentages(ageGroupDistribution, totalPatients);

        var patientRows = await patientQuery
            .OrderBy(p => p.Lastname)
            .ThenBy(p => p.Firstname)
            .ThenBy(p => p.DossierNumber)
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new StatisticsPatientRow
            {
                Id = p.Id,
                DossierNumber = p.DossierNumber,
                Firstname = p.Firstname,
                Lastname = p.Lastname,
                Sex = p.Sex,
                DateOfBirth = p.DateOfBirth,
                InsuranceType = p.InsuranceType,
                InsuranceEstablishment = p.InsuranceEstablishment,
                APCI = p.APCI,
            })
            .ToListAsync();

        var patients = await BuildPatients(patientRows, cabinetIdentityId, selectedDiagnostics, today);

        return new StatisticsPatientSectionResponse
        {
            TotalPatients = totalPatients,
            PatientsWithDiagnostics = patientsWithDiagnostics,
            CnamCoverage = cnamCoverage,
            SexDistribution = sexDistribution,
            AgeGroupDistribution = ageGroupDistribution,
            Pagination = new StatisticsPaginationResponse
            {
                PageNumber = pageNumber,
                PageSize = pageSize,
                TotalCount = totalPatients,
                TotalPages = Math.Max(1, (int)Math.Ceiling(totalPatients / (double)pageSize)),
            },
            Patients = patients,
        };
    }

    private async Task<List<StatisticsPatientResponse>> BuildPatients(
        IReadOnlyCollection<StatisticsPatientRow> patientRows,
        Guid cabinetIdentityId,
        IReadOnlyCollection<string> selectedDiagnostics,
        DateTime today)
    {
        if (patientRows.Count == 0)
        {
            return [];
        }

        var patientIds = patientRows.Select(p => p.Id).ToList();
        var historyQuery = db.Consultations
            .AsNoTracking()
            .Where(c => c.CabinetIdentityId == cabinetIdentityId && patientIds.Contains(c.PatientId));

        if (selectedDiagnostics.Count > 0)
        {
            historyQuery = ApplyAnyDiagnosticFilter(historyQuery, selectedDiagnostics);
        }

        var consultationCountsByPatient = await historyQuery
            .GroupBy(c => c.PatientId)
            .Select(g => new { PatientId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(g => g.PatientId, g => g.Count);

        var consultationRowsBase = await historyQuery
            .OrderByDescending(c => c.ConsultationDate)
            .ThenByDescending(c => c.CreatedAt)
            .Select(c => new StatisticsConsultationRow
            {
                Id = c.Id,
                PatientId = c.PatientId,
                ConsultationDate = c.ConsultationDate,
                DurationSeconds = c.DurationSeconds,
                IsTimerPaused = c.IsTimerPaused,
                IsDone = c.IsDone,
                Diagnostics = c.Interrogatoire.Diagnostics,
            })
            .ToListAsync();

        var consultationIds = consultationRowsBase.Select(c => c.Id).ToList();
        var motifsLookup = await BuildMotifsLookup(consultationIds);
        var conduiteActionsLookup = await BuildConduiteActionsLookup(consultationIds);

        foreach (var row in consultationRowsBase)
        {
            row.Motifs = motifsLookup.TryGetValue(row.Id, out var motifs) ? motifs : [];
            row.ConduiteActions = conduiteActionsLookup.TryGetValue(row.Id, out var actions) ? actions : [];
        }

        var consultationsLookup = consultationRowsBase
            .GroupBy(row => row.PatientId)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(row => row.ConsultationDate).ToList());

        return patientRows
            .Select(patient =>
            {
                consultationsLookup.TryGetValue(patient.Id, out var patientConsultations);
                patientConsultations ??= [];

                return new StatisticsPatientResponse
                {
                    Id = patient.Id,
                    DossierNumber = patient.DossierNumber,
                    Firstname = patient.Firstname ?? string.Empty,
                    Lastname = patient.Lastname ?? string.Empty,
                    Sex = patient.Sex ?? string.Empty,
                    Age = CalculateAge(patient.DateOfBirth, today),
                    InsuranceType = patient.InsuranceType ?? string.Empty,
                    InsuranceEstablishment = patient.InsuranceEstablishment ?? string.Empty,
                    HasCnam = HasCnam(patient.InsuranceType, patient.InsuranceEstablishment, patient.APCI),
                    MatchingConsultationCount = consultationCountsByPatient.TryGetValue(patient.Id, out var count) ? count : 0,
                    Consultations = patientConsultations
                        .Select(row => new StatisticsPatientConsultationResponse
                        {
                            Id = row.Id,
                            ConsultationDate = row.ConsultationDate,
                            Duration = FormatDuration(row.DurationSeconds),
                            IsTimerPaused = row.IsTimerPaused,
                            IsDone = row.IsDone,
                            Motifs = row.Motifs,
                            Diagnostics = row.Diagnostics
                                .Where(d => !string.IsNullOrWhiteSpace(d))
                                .Select(d => d.Trim())
                                .ToList(),
                            ConduiteActions = row.ConduiteActions,
                        })
                        .ToList(),
                };
            })
            .ToList();
    }

    private async Task<Dictionary<Guid, List<string>>> BuildMotifsLookup(IReadOnlyCollection<Guid> consultationIds)
    {
        if (consultationIds.Count == 0)
        {
            return [];
        }

        var rows = await db.ConsultationMotifs
            .AsNoTracking()
            .Where(m => consultationIds.Contains(m.ConsultationId))
            .OrderBy(m => m.CreatedAt)
            .Select(m => new { m.ConsultationId, m.Value })
            .ToListAsync();

        return rows
            .GroupBy(m => m.ConsultationId)
            .ToDictionary(g => g.Key, g => g.Select(m => m.Value).Where(v => !string.IsNullOrWhiteSpace(v)).ToList());
    }

    private async Task<Dictionary<Guid, List<string>>> BuildConduiteActionsLookup(IReadOnlyCollection<Guid> consultationIds)
    {
        if (consultationIds.Count == 0)
        {
            return [];
        }

        var rows = await db.ConsultationConduiteActions
            .AsNoTracking()
            .Where(a => consultationIds.Contains(a.ConsultationId))
            .OrderBy(a => a.SortOrder)
            .Select(a => new { a.ConsultationId, a.ActionKey })
            .ToListAsync();

        return rows
            .GroupBy(a => a.ConsultationId)
            .ToDictionary(g => g.Key, g => g
                .Select(a => FormatConduiteActionLabel(a.ActionKey))
                .Where(label => !string.IsNullOrWhiteSpace(label))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList());
    }

    private async Task<List<StatisticsBucketResponse>> BuildTimelineBuckets(
        IQueryable<Consultation> consultationQuery,
        StatisticsDateRange dateRange)
    {
        return dateRange.ChartGranularity switch
        {
            "day" => await BuildDayBuckets(consultationQuery, dateRange),
            "week" => await BuildWeekBuckets(consultationQuery, dateRange),
            "month" => await BuildMonthBuckets(consultationQuery, dateRange),
            _ => await BuildYearBuckets(consultationQuery, dateRange),
        };
    }

    private static async Task<List<StatisticsBucketResponse>> BuildDayBuckets(
        IQueryable<Consultation> consultationQuery,
        StatisticsDateRange dateRange)
    {
        var rows = await consultationQuery
            .GroupBy(c => c.ConsultationDate.Date)
            .OrderBy(g => g.Key)
            .Select(g => new StatisticsDayCount(g.Key, g.Count()))
            .ToListAsync();

        if (rows.Count == 0 && !dateRange.Start.HasValue)
        {
            return [];
        }

        var counts = rows.ToDictionary(row => row.Date.Date, row => row.Count);
        var start = ResolveStartDate(dateRange, rows.Select(row => row.Date)).Date;
        var end = ResolveEndDate(dateRange, rows.Select(row => row.Date)).Date;
        if (end < start)
        {
            end = start;
        }

        var result = new List<StatisticsBucketResponse>();
        for (var date = start; date <= end; date = date.AddDays(1))
        {
            result.Add(new StatisticsBucketResponse
            {
                Label = date.ToString("yyyy-MM-dd"),
                Count = counts.TryGetValue(date, out var count) ? count : 0,
            });
        }

        return result;
    }

    private static async Task<List<StatisticsBucketResponse>> BuildWeekBuckets(
        IQueryable<Consultation> consultationQuery,
        StatisticsDateRange dateRange)
    {
        var dayRows = await consultationQuery
            .GroupBy(c => c.ConsultationDate.Date)
            .OrderBy(g => g.Key)
            .Select(g => new StatisticsDayCount(g.Key, g.Count()))
            .ToListAsync();

        if (dayRows.Count == 0 && !dateRange.Start.HasValue)
        {
            return [];
        }

        var weekCounts = dayRows
            .GroupBy(row => StartOfWeek(row.Date))
            .ToDictionary(g => g.Key.Date, g => g.Sum(row => row.Count));

        var start = StartOfWeek(ResolveStartDate(dateRange, dayRows.Select(row => row.Date)));
        var end = StartOfWeek(ResolveEndDate(dateRange, dayRows.Select(row => row.Date)));
        if (end < start)
        {
            end = start;
        }

        var result = new List<StatisticsBucketResponse>();
        for (var week = start; week <= end; week = week.AddDays(7))
        {
            result.Add(new StatisticsBucketResponse
            {
                Label = week.ToString("yyyy-MM-dd"),
                Count = weekCounts.TryGetValue(week, out var count) ? count : 0,
            });
        }

        return result;
    }

    private static async Task<List<StatisticsBucketResponse>> BuildMonthBuckets(
        IQueryable<Consultation> consultationQuery,
        StatisticsDateRange dateRange)
    {
        var rows = await consultationQuery
            .GroupBy(c => new { c.ConsultationDate.Year, c.ConsultationDate.Month })
            .OrderBy(g => g.Key.Year)
            .ThenBy(g => g.Key.Month)
            .Select(g => new StatisticsMonthCount(g.Key.Year, g.Key.Month, g.Count()))
            .ToListAsync();

        if (rows.Count == 0 && !dateRange.Start.HasValue)
        {
            return [];
        }

        var counts = rows.ToDictionary(row => new DateTime(row.Year, row.Month, 1), row => row.Count);
        var monthDates = rows.Select(row => new DateTime(row.Year, row.Month, 1));
        var startSource = ResolveStartDate(dateRange, monthDates);
        var endSource = ResolveEndDate(dateRange, monthDates);
        var start = new DateTime(startSource.Year, startSource.Month, 1);
        var end = new DateTime(endSource.Year, endSource.Month, 1);
        if (end < start)
        {
            end = start;
        }

        var result = new List<StatisticsBucketResponse>();
        for (var month = start; month <= end; month = month.AddMonths(1))
        {
            result.Add(new StatisticsBucketResponse
            {
                Label = $"{month.Year}-{month.Month:D2}",
                Count = counts.TryGetValue(month, out var count) ? count : 0,
            });
        }

        return result;
    }

    private static async Task<List<StatisticsBucketResponse>> BuildYearBuckets(
        IQueryable<Consultation> consultationQuery,
        StatisticsDateRange dateRange)
    {
        var rows = await consultationQuery
            .GroupBy(c => c.ConsultationDate.Year)
            .OrderBy(g => g.Key)
            .Select(g => new StatisticsBucketResponse
            {
                Label = g.Key.ToString(),
                Count = g.Count(),
            })
            .ToListAsync();

        if (rows.Count == 0 && !dateRange.Start.HasValue)
        {
            return [];
        }

        var rowCounts = rows.ToDictionary(row => int.Parse(row.Label), row => row.Count);
        var years = rowCounts.Keys.Select(year => new DateTime(year, 1, 1));
        var startYear = ResolveStartDate(dateRange, years).Year;
        var endYear = ResolveEndDate(dateRange, years).Year;
        if (endYear < startYear)
        {
            endYear = startYear;
        }

        var result = new List<StatisticsBucketResponse>();
        for (var year = startYear; year <= endYear; year++)
        {
            result.Add(new StatisticsBucketResponse
            {
                Label = year.ToString(),
                Count = rowCounts.TryGetValue(year, out var count) ? count : 0,
            });
        }

        return result;
    }

    private async Task<StatisticsCnamCoverageResponse> BuildCnamCoverage(IQueryable<Patient> patientQuery, int totalPatients)
    {
        var coverage = await patientQuery
            .GroupBy(_ => 1)
            .Select(g => new StatisticsCnamCoverageResponse
            {
                WithCnam = g.Count(p =>
                    EF.Functions.ILike(p.InsuranceType, "%cnam%") ||
                    EF.Functions.ILike(p.InsuranceEstablishment, "%cnam%") ||
                    EF.Functions.ILike(p.APCI, "%cnam%") ||
                    (p.APCI != null &&
                     p.APCI.Trim() != string.Empty &&
                     !EF.Functions.ILike(p.APCI.Trim(), "non") &&
                     !EF.Functions.ILike(p.APCI.Trim(), "no") &&
                     !EF.Functions.ILike(p.APCI.Trim(), "none") &&
                     !EF.Functions.ILike(p.APCI.Trim(), "aucun") &&
                     !EF.Functions.ILike(p.APCI.Trim(), "false") &&
                     p.APCI.Trim() != "0")),
                WithoutCnam = g.Count(p =>
                    !EF.Functions.ILike(p.InsuranceType, "%cnam%") &&
                    !EF.Functions.ILike(p.InsuranceEstablishment, "%cnam%") &&
                    !EF.Functions.ILike(p.APCI, "%cnam%") &&
                    (p.APCI == null ||
                     p.APCI.Trim() == string.Empty ||
                     EF.Functions.ILike(p.APCI.Trim(), "non") ||
                     EF.Functions.ILike(p.APCI.Trim(), "no") ||
                     EF.Functions.ILike(p.APCI.Trim(), "none") ||
                     EF.Functions.ILike(p.APCI.Trim(), "aucun") ||
                     EF.Functions.ILike(p.APCI.Trim(), "false") ||
                     p.APCI.Trim() == "0")),
            })
            .FirstOrDefaultAsync() ?? new StatisticsCnamCoverageResponse();

        coverage.WithCnamPercentage = Percentage(coverage.WithCnam, totalPatients);
        coverage.WithoutCnamPercentage = Percentage(coverage.WithoutCnam, totalPatients);
        return coverage;
    }

    private static async Task<List<StatisticsBucketResponse>> BuildSexDistribution(IQueryable<Patient> patientQuery, int totalPatients)
    {
        var buckets = await patientQuery
            .GroupBy(p => string.IsNullOrWhiteSpace(p.Sex) ? "Non renseigne" : p.Sex.Trim())
            .OrderByDescending(g => g.Count())
            .ThenBy(g => g.Key)
            .Select(g => new StatisticsBucketResponse
            {
                Label = g.Key,
                Count = g.Count(),
            })
            .ToListAsync();

        ApplyPercentages(buckets, totalPatients);
        return buckets;
    }

    private static IQueryable<Patient> ApplyPatientLevelFilters(
        IQueryable<Patient> query,
        StatisticsOverviewRequest request,
        DateTime today)
    {
        var sex = request.Sex?.Trim();
        if (!string.IsNullOrWhiteSpace(sex))
        {
            query = query.Where(p => EF.Functions.ILike(p.Sex, sex));
        }

        var cnamStatus = request.CnamStatus?.Trim().ToLowerInvariant();
        if (cnamStatus is "with" or "without")
        {
            query = cnamStatus == "with"
                ? query.Where(p =>
                    EF.Functions.ILike(p.InsuranceType, "%cnam%") ||
                    EF.Functions.ILike(p.InsuranceEstablishment, "%cnam%") ||
                    EF.Functions.ILike(p.APCI, "%cnam%") ||
                    (p.APCI != null &&
                     p.APCI.Trim() != string.Empty &&
                     !EF.Functions.ILike(p.APCI.Trim(), "non") &&
                     !EF.Functions.ILike(p.APCI.Trim(), "no") &&
                     !EF.Functions.ILike(p.APCI.Trim(), "none") &&
                     !EF.Functions.ILike(p.APCI.Trim(), "aucun") &&
                     !EF.Functions.ILike(p.APCI.Trim(), "false") &&
                     p.APCI.Trim() != "0"))
                : query.Where(p =>
                    !EF.Functions.ILike(p.InsuranceType, "%cnam%") &&
                    !EF.Functions.ILike(p.InsuranceEstablishment, "%cnam%") &&
                    !EF.Functions.ILike(p.APCI, "%cnam%") &&
                    (p.APCI == null ||
                     p.APCI.Trim() == string.Empty ||
                     EF.Functions.ILike(p.APCI.Trim(), "non") ||
                     EF.Functions.ILike(p.APCI.Trim(), "no") ||
                     EF.Functions.ILike(p.APCI.Trim(), "none") ||
                     EF.Functions.ILike(p.APCI.Trim(), "aucun") ||
                     EF.Functions.ILike(p.APCI.Trim(), "false") ||
                     p.APCI.Trim() == "0"));
        }

        var (minAge, maxAge) = ResolveAgeRange(request);
        if (minAge.HasValue)
        {
            var bornOnOrBefore = today.AddYears(-minAge.Value);
            query = query.Where(p => p.DateOfBirth.Date <= bornOnOrBefore);
        }

        if (maxAge.HasValue)
        {
            var bornAfter = today.AddYears(-(maxAge.Value + 1));
            query = query.Where(p => p.DateOfBirth.Date > bornAfter);
        }

        return query;
    }

    private IQueryable<Patient> ApplyDiagnosticPatientFilter(
        IQueryable<Patient> query,
        Guid cabinetIdentityId,
        IReadOnlyCollection<string> selectedDiagnostics)
    {
        if (selectedDiagnostics.Count == 0)
        {
            return query;
        }

        var selected = selectedDiagnostics.ToArray();
        var selectedCount = selected.Length;
        var diagnosisPatientIds = db.Consultations
            .AsNoTracking()
            .Where(c => c.CabinetIdentityId == cabinetIdentityId)
            .SelectMany(c => c.Interrogatoire.Diagnostics
                .Where(d => d != null && selected.Contains(d.ToLower().Trim()))
                .Select(d => new
                {
                    c.PatientId,
                    Diagnostic = d.ToLower().Trim(),
                }))
            .Distinct()
            .GroupBy(item => item.PatientId)
            .Where(group => group.Count() == selectedCount)
            .Select(group => group.Key);

        return query.Where(p => diagnosisPatientIds.Contains(p.Id));
    }

    private static IQueryable<Consultation> ApplyConsultationScopeFilters(
        IQueryable<Consultation> query,
        StatisticsDateRange dateRange,
        IReadOnlyCollection<string> selectedDiagnostics)
    {
        if (dateRange.Start.HasValue)
        {
            query = query.Where(c => c.ConsultationDate >= dateRange.Start.Value);
        }

        if (dateRange.EndExclusive.HasValue)
        {
            query = query.Where(c => c.ConsultationDate < dateRange.EndExclusive.Value);
        }

        return ApplyDiagnosticFilter(query, selectedDiagnostics);
    }

    private static IQueryable<Consultation> ApplyDiagnosticFilter(
        IQueryable<Consultation> query,
        IReadOnlyCollection<string> selectedDiagnostics)
    {
        if (selectedDiagnostics.Count == 0)
        {
            return query;
        }

        var selected = selectedDiagnostics.ToArray();
        var selectedCount = selected.Length;
        var consultationIdsWithAllDiagnostics = query
            .SelectMany(c => c.Interrogatoire.Diagnostics
                .Where(d => d != null && selected.Contains(d.ToLower().Trim()))
                .Select(d => new
                {
                    ConsultationId = c.Id,
                    Diagnostic = d.ToLower().Trim(),
                }))
            .Distinct()
            .GroupBy(item => item.ConsultationId)
            .Where(group => group.Count() == selectedCount)
            .Select(group => group.Key);

        return query.Where(c => consultationIdsWithAllDiagnostics.Contains(c.Id));
    }

    private static IQueryable<Consultation> ApplyAnyDiagnosticFilter(
        IQueryable<Consultation> query,
        IReadOnlyCollection<string> selectedDiagnostics)
    {
        if (selectedDiagnostics.Count == 0)
        {
            return query;
        }

        return query.Where(c => c.Interrogatoire.Diagnostics.Any(d =>
            d != null && selectedDiagnostics.Contains(d.ToLower().Trim())));
    }

    private static bool HasPatientLevelFilters(StatisticsOverviewRequest request)
    {
        return !string.IsNullOrWhiteSpace(request.Sex) ||
               !string.IsNullOrWhiteSpace(request.CnamStatus) ||
               !string.IsNullOrWhiteSpace(request.AgeGroup) ||
               request.MinAge.HasValue ||
               request.MaxAge.HasValue;
    }

    private static StatisticsDateRange ResolveDateRange(StatisticsOverviewRequest request, DateTime today)
    {
        var period = NormalizePeriod(request.Period);

        return period switch
        {
            "this_week" => new StatisticsDateRange(
                period,
                StartOfWeek(today),
                StartOfWeek(today).AddDays(7),
                "day"),
            "this_month" => new StatisticsDateRange(
                period,
                new DateTime(today.Year, today.Month, 1, 0, 0, 0, DateTimeKind.Utc),
                new DateTime(today.Year, today.Month, 1, 0, 0, 0, DateTimeKind.Utc).AddMonths(1),
                "week"),
            "this_year" => new StatisticsDateRange(
                period,
                new DateTime(today.Year, 1, 1, 0, 0, 0, DateTimeKind.Utc),
                new DateTime(today.Year + 1, 1, 1, 0, 0, 0, DateTimeKind.Utc),
                "month"),
            "custom" => ResolveCustomDateRange(request),
            _ => new StatisticsDateRange("all_time", null, null, "year")
        };
    }

    private static StatisticsDateRange ResolveCustomDateRange(StatisticsOverviewRequest request)
    {
        var start = request.StartDate.HasValue
            ? DateTime.SpecifyKind(request.StartDate.Value.Date, DateTimeKind.Utc)
            : (DateTime?)null;
        var endExclusive = request.EndDate.HasValue
            ? DateTime.SpecifyKind(request.EndDate.Value.Date.AddDays(1), DateTimeKind.Utc)
            : (DateTime?)null;

        if (start.HasValue && endExclusive.HasValue && start.Value >= endExclusive.Value)
        {
            (start, endExclusive) = (endExclusive.Value.AddDays(-1), start.Value.AddDays(1));
        }

        var spanDays = start.HasValue && endExclusive.HasValue
            ? Math.Max(1, (endExclusive.Value - start.Value).Days)
            : 366;
        var granularity = spanDays <= 31 ? "day" : spanDays <= 120 ? "week" : spanDays <= 730 ? "month" : "year";

        return new StatisticsDateRange("custom", start, endExclusive, granularity);
    }

    private static string NormalizePeriod(string? period)
    {
        var normalized = period?.Trim().ToLowerInvariant();
        return normalized is "this_week" or "this_month" or "this_year" or "custom" or "all_time"
            ? normalized
            : "all_time";
    }

    private static (int? MinAge, int? MaxAge) ResolveAgeRange(StatisticsOverviewRequest request)
    {
        var minAge = request.MinAge;
        var maxAge = request.MaxAge;
        var ageGroup = request.AgeGroup?.Trim();

        if (!string.IsNullOrWhiteSpace(ageGroup))
        {
            var group = AgeGroups.FirstOrDefault(g => string.Equals(g.Key, ageGroup, StringComparison.OrdinalIgnoreCase));
            if (!string.IsNullOrWhiteSpace(group.Key))
            {
                minAge = group.MinAge;
                maxAge = group.MaxAge;
            }
        }

        if (minAge < 0) minAge = 0;
        if (maxAge < 0) maxAge = 0;
        if (minAge.HasValue && maxAge.HasValue && minAge > maxAge)
        {
            (minAge, maxAge) = (maxAge, minAge);
        }

        return (minAge, maxAge);
    }

    private static List<StatisticsBucketResponse> BuildAgeGroupDistribution(IEnumerable<DateTime> birthDates, DateTime today)
    {
        var counts = AgeGroups.ToDictionary(g => g.Label, _ => 0);

        foreach (var birthDate in birthDates)
        {
            var age = CalculateAge(birthDate, today);
            var group = AgeGroups.First(g =>
                (!g.MinAge.HasValue || age >= g.MinAge.Value) &&
                (!g.MaxAge.HasValue || age <= g.MaxAge.Value));
            counts[group.Label]++;
        }

        return counts.Select(item => new StatisticsBucketResponse
        {
            Label = item.Key,
            Count = item.Value,
        }).ToList();
    }

    private static List<StatisticsBucketResponse> BuildCnamFormDistribution(IEnumerable<Dictionary<string, JsonElement>> payloads)
    {
        return payloads
            .Select(ReadCnamFormType)
            .GroupBy(formType => formType)
            .OrderByDescending(g => g.Count())
            .ThenBy(g => g.Key)
            .Select(g => new StatisticsBucketResponse
            {
                Label = g.Key,
                Count = g.Count(),
            })
            .ToList();
    }

    private static void ApplyPercentages(IEnumerable<StatisticsBucketResponse> buckets, int total)
    {
        foreach (var bucket in buckets)
        {
            bucket.Percentage = Percentage(bucket.Count, total);
        }
    }

    private static double Percentage(int count, int total)
    {
        return total <= 0 ? 0 : Math.Round((count / (double)total) * 100, 1);
    }

    private static DateTime StartOfWeek(DateTime date)
    {
        var diff = ((int)date.DayOfWeek + 6) % 7;
        return date.Date.AddDays(-diff);
    }

    private static DateTime ResolveStartDate(StatisticsDateRange dateRange, IEnumerable<DateTime> dates)
    {
        if (dateRange.Start.HasValue)
        {
            return dateRange.Start.Value.Date;
        }

        var dateList = dates.ToList();
        if (dateList.Count > 0)
        {
            return dateList.Min().Date;
        }

        return (dateRange.EndExclusive?.AddDays(-1) ?? DateTime.UtcNow.Date).Date;
    }

    private static DateTime ResolveEndDate(StatisticsDateRange dateRange, IEnumerable<DateTime> dates)
    {
        if (dateRange.EndExclusive.HasValue)
        {
            return dateRange.EndExclusive.Value.AddDays(-1).Date;
        }

        var dateList = dates.ToList();
        if (dateList.Count > 0)
        {
            return dateList.Max().Date;
        }

        return (dateRange.Start ?? DateTime.UtcNow.Date).Date;
    }

    private static string ReadCnamFormType(Dictionary<string, JsonElement> payload)
    {
        if (payload.TryGetValue("selectedFormType", out var element) && element.ValueKind == JsonValueKind.String)
        {
            var value = element.GetString()?.Trim();
            if (!string.IsNullOrWhiteSpace(value))
            {
                return value.ToUpperInvariant();
            }
        }

        return "CNAM";
    }

    private static int CalculateAge(DateTime birthDate, DateTime onDate)
    {
        var age = onDate.Year - birthDate.Year;
        if (onDate.Date < birthDate.Date.AddYears(age))
        {
            age--;
        }

        return Math.Max(0, age);
    }

    private static bool HasCnam(string? insuranceType, string? insuranceEstablishment, string? apci)
    {
        return ContainsCnam(insuranceType) ||
               ContainsCnam(insuranceEstablishment) ||
               ContainsCnam(apci) ||
               HasMeaningfulApci(apci);
    }

    private static bool ContainsCnam(string? value)
    {
        return (value ?? string.Empty).Contains("cnam", StringComparison.OrdinalIgnoreCase);
    }

    private static bool HasMeaningfulApci(string? apci)
    {
        var normalized = (apci ?? string.Empty).Trim();
        if (normalized.Length == 0)
        {
            return false;
        }

        return !string.Equals(normalized, "non", StringComparison.OrdinalIgnoreCase) &&
               !string.Equals(normalized, "no", StringComparison.OrdinalIgnoreCase) &&
               !string.Equals(normalized, "none", StringComparison.OrdinalIgnoreCase) &&
               !string.Equals(normalized, "aucun", StringComparison.OrdinalIgnoreCase) &&
               !string.Equals(normalized, "false", StringComparison.OrdinalIgnoreCase) &&
               normalized != "0";
    }

    private static string FormatDuration(int durationSeconds)
    {
        var duration = TimeSpan.FromSeconds(Math.Max(0, durationSeconds));
        return duration.ToString(@"hh\:mm\:ss");
    }

    private static string FormatConduiteActionLabel(string actionKey)
    {
        return actionKey switch
        {
            "ordonnance" => "Ordonnance",
            "certificat" => "Certificat",
            "lettre_confrere" => "Lettre confrère",
            "paraclinique_chirurgie" => "Chirurgie",
            "paraclinique_laser" => "Laser",
            "paraclinique_imagerie" => "Imagerie",
            "paraclinique_bilan_sanguin" => "Bilan sanguin",
            "cnam" => "CNAM",
            _ => actionKey
        };
    }

    private static List<string> NormalizeDiagnostics(StatisticsOverviewRequest request)
    {
        var diagnostics = (request.Diagnostics ?? []).ToList();
        if (!string.IsNullOrWhiteSpace(request.Diagnosis))
        {
            diagnostics.Add(request.Diagnosis);
        }

        return diagnostics
            .Select(d => d.Trim().ToLowerInvariant())
            .Where(d => d.Length > 0)
            .Distinct(StringComparer.Ordinal)
            .ToList();
    }

    private sealed record StatisticsDayCount(DateTime Date, int Count);

    private sealed record StatisticsMonthCount(int Year, int Month, int Count);

    private sealed record StatisticsDateRange(
        string Period,
        DateTime? Start,
        DateTime? EndExclusive,
        string ChartGranularity);

    private sealed class StatisticsPatientRow
    {
        public Guid Id { get; set; }
        public int DossierNumber { get; set; }
        public string? Firstname { get; set; }
        public string? Lastname { get; set; }
        public string? Sex { get; set; }
        public DateTime DateOfBirth { get; set; }
        public string? InsuranceType { get; set; }
        public string? InsuranceEstablishment { get; set; }
        public string? APCI { get; set; }
    }

    private sealed class StatisticsConsultationRow
    {
        public Guid Id { get; set; }
        public Guid PatientId { get; set; }
        public DateTime ConsultationDate { get; set; }
        public int DurationSeconds { get; set; }
        public bool IsTimerPaused { get; set; }
        public bool IsDone { get; set; }
        public string[] Diagnostics { get; set; } = [];
        public List<string> Motifs { get; set; } = [];
        public List<string> ConduiteActions { get; set; } = [];
    }
}
