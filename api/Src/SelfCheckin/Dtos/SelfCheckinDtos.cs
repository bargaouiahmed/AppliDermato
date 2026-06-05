using System.Text.Json;
using api.Src.ConsultationSpace.InterrogationSection.Dtos.Responses;

namespace api.Src.SelfCheckin.Dtos;

public sealed record SelfCheckinDoctorContext(
    Guid DoctorId,
    Guid CabinetIdentityId,
    string DisplayName,
    bool Enabled,
    int TimeoutSeconds);

public sealed class SelfCheckinBootstrapResponse
{
    public required SelfCheckinDoctorDto Doctor { get; init; }
    public bool Enabled { get; init; }
    public int TimeoutSeconds { get; init; }
    public List<string> Motifs { get; init; } = [];
    public List<string> ProfessionOptions { get; init; } = [];
    public List<string> TreatmentOptions { get; init; } = [];
}

public sealed class SelfCheckinDoctorDto
{
    public Guid Id { get; init; }
    public string DisplayName { get; init; } = string.Empty;
    public string Speciality { get; init; } = string.Empty;
}

public sealed class SelfCheckinFindPatientRequest
{
    public string SearchType { get; set; } = string.Empty;
    public string Nom { get; set; } = string.Empty;
    public string Prenom { get; set; } = string.Empty;
    public string Tel { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string NumFiche { get; set; } = string.Empty;
    public string DateAnniversaire { get; set; } = string.Empty;
}

public sealed class SelfCheckinPatientSummary
{
    public Guid Id { get; init; }
    public string Firstname { get; init; } = string.Empty;
    public string Lastname { get; init; } = string.Empty;
    public string Email { get; init; } = string.Empty;
    public string PhoneNumber { get; init; } = string.Empty;
    public int DossierNumber { get; init; }
    public string DateOfBirth { get; init; } = string.Empty;
}

public sealed class SelfCheckinCreatePatientRequest
{
    public string Firstname { get; set; } = string.Empty;
    public string Lastname { get; set; } = string.Empty;
    public string DateOfBirth { get; set; } = string.Empty;
    public string Sex { get; set; } = string.Empty;

    public string PhoneNumber { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Profession { get; set; } = string.Empty;
    public string WorkPlace { get; set; } = string.Empty;
    public string FamilialStatus { get; set; } = string.Empty;
    public string Country { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string PostalCode { get; set; } = string.Empty;
    public string Apci { get; set; } = string.Empty;
    public string InsuranceType { get; set; } = string.Empty;
    public string InsuranceEstablishment { get; set; } = string.Empty;
}

public sealed class SelfCheckinCreateConsultationRequest
{
    public Guid PatientId { get; set; }
    public DateTime? ConsultationDate { get; set; }
    public List<string> Motifs { get; set; } = [];
}

public sealed class SelfCheckinCreateConsultationResponse
{
    public Guid ConsultationId { get; init; }
    public bool Reused { get; init; }
    public string Code { get; init; } = string.Empty;
    public string Message { get; init; } = string.Empty;
    public required ConsultationInterrogatoireResponse Consultation { get; init; }
}

public sealed class SelfCheckinPatchMotifRequest
{
    public List<string> Motifs { get; set; } = [];
}

public sealed class SelfCheckinPatchInterrogatoireRequest
{
    public string HistoireMaladie { get; set; } = string.Empty;
    public List<string> Diagnostics { get; set; } = [];
    public List<SelfCheckinAnomalyRequest> Anomalies { get; set; } = [];
    public List<SelfCheckinOngoingTreatmentRequest> OngoingTreatments { get; set; } = [];
}

public sealed class SelfCheckinAnomalyRequest
{
    public string Section { get; set; } = string.Empty;
    public bool IsCustom { get; set; }
    public string? TemplateKey { get; set; }
    public int SortOrder { get; set; }
    public Dictionary<string, JsonElement> Payload { get; set; } = [];
}

public sealed class SelfCheckinOngoingTreatmentRequest
{
    public string Medicine { get; set; } = string.Empty;
    public string TherapeuticClass { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string Posology { get; set; } = string.Empty;
    public string Duration { get; set; } = string.Empty;
    public string Date { get; set; } = string.Empty;
}

public sealed class SelfCheckinErrorResponse
{
    public string Code { get; init; } = "SELF_CHECKIN_ERROR";
    public string Message { get; init; } = "Unexpected server error.";
}

