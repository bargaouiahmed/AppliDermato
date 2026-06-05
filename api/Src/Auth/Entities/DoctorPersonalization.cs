using api.DatabaseRules;

namespace api.Src.Auth.Entities;

public class DoctorPersonalization : BaseEntity
{
    public Guid Id { get; set; }

    public Guid DoctorId { get; set; }
    public Doctor? Doctor { get; set; }

    public string CylinderScale { get; set; } = "negatif";
    public string DistanceVisualScale { get; set; } = "snellen";

    public string? WaitingRoomMessage { get; set; } = string.Empty;
    public string? DailyNews { get; set; }
    public string? DailyNewsFr { get; set; }
    public string? DailyNewsEn { get; set; }
    public string? DailyNewsAr { get; set; }
    public bool UseSuperAdminDailyNews { get; set; } = true;
    public bool AutoDailyNewsEnabled { get; set; }

    public bool ShowHeader { get; set; } = true;
    public bool ShowFirstName { get; set; } = true;
    public bool ShowLastName { get; set; } = true;
    public bool ShowCodeCnam { get; set; } = true;
    public bool ShowFirstNameArabic { get; set; }
    public bool ShowLastNameArabic { get; set; }

    public bool ShowFooter { get; set; } = true;
    public bool ShowFooterCabinetAddress { get; set; } = true;
    public bool ShowFooterLandline { get; set; } = true;
    public bool ShowFooterMobile { get; set; } = true;
    public bool ShowFooterEmail { get; set; } = true;
}
