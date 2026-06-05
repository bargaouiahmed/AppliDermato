namespace api.Src.Statistics.Dtos;

public class StatisticsOverviewRequest
{
    public string? Period { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public string? Diagnosis { get; set; }
    public List<string> Diagnostics { get; set; } = [];
    public string? Sex { get; set; }
    public string? CnamStatus { get; set; }
    public int? MinAge { get; set; }
    public int? MaxAge { get; set; }
    public string? AgeGroup { get; set; }
    public int PageNumber { get; set; } = 1;
    public int PageSize { get; set; } = 10;
}

public class StatisticsOverviewResponse
{
    public StatisticsConsultationSectionResponse ConsultationStatistics { get; set; } = new();
    public StatisticsPatientSectionResponse PatientStatistics { get; set; } = new();
}

public class StatisticsConsultationSectionResponse
{
    public string Period { get; set; } = "all_time";
    public string ChartGranularity { get; set; } = "year";
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public List<StatisticsBucketResponse> Timeline { get; set; } = [];
    public int TotalConsultations { get; set; }
    public int CompletedConsultations { get; set; }
    public int NotCompletedConsultations { get; set; }
    public int AverageDurationSeconds { get; set; }
    public string AverageDuration { get; set; } = "00:00:00";
    public List<StatisticsBucketResponse> DiagnosticFrequency { get; set; } = [];
    public List<StatisticsBucketResponse> CnamForms { get; set; } = [];
}

public class StatisticsPatientSectionResponse
{
    public int TotalPatients { get; set; }
    public int PatientsWithDiagnostics { get; set; }
    public StatisticsCnamCoverageResponse CnamCoverage { get; set; } = new();
    public List<StatisticsBucketResponse> SexDistribution { get; set; } = [];
    public List<StatisticsBucketResponse> AgeGroupDistribution { get; set; } = [];
    public StatisticsPaginationResponse Pagination { get; set; } = new();
    public List<StatisticsPatientResponse> Patients { get; set; } = [];
}

public class StatisticsPaginationResponse
{
    public int PageNumber { get; set; } = 1;
    public int PageSize { get; set; } = 10;
    public int TotalCount { get; set; }
    public int TotalPages { get; set; } = 1;
}

public class StatisticsBucketResponse
{
    public string Label { get; set; } = string.Empty;
    public int Count { get; set; }
    public double Percentage { get; set; }
}

public class StatisticsCnamCoverageResponse
{
    public int WithCnam { get; set; }
    public int WithoutCnam { get; set; }
    public double WithCnamPercentage { get; set; }
    public double WithoutCnamPercentage { get; set; }
}

public class StatisticsPatientResponse
{
    public Guid Id { get; set; }
    public int DossierNumber { get; set; }
    public string Firstname { get; set; } = string.Empty;
    public string Lastname { get; set; } = string.Empty;
    public string Sex { get; set; } = string.Empty;
    public int Age { get; set; }
    public string InsuranceType { get; set; } = string.Empty;
    public string InsuranceEstablishment { get; set; } = string.Empty;
    public bool HasCnam { get; set; }
    public int MatchingConsultationCount { get; set; }
    public List<StatisticsPatientConsultationResponse> Consultations { get; set; } = [];
}

public class StatisticsPatientConsultationResponse
{
    public Guid Id { get; set; }
    public DateTime ConsultationDate { get; set; }
    public string Duration { get; set; } = "00:00:00";
    public bool IsTimerPaused { get; set; }
    public bool IsDone { get; set; }
    public List<string> Motifs { get; set; } = [];
    public List<string> Diagnostics { get; set; } = [];
    public List<string> ConduiteActions { get; set; } = [];
}
