using api.DatabaseRules;
using api.Src.Auth.Entities;
using api.Src.PatientSpace.Entities;

namespace api.Src.AgendaSpace.Entities;

public enum RdvStatus
{
    Disponible,
    EnAttenteDeValidation,
    Confirme,
    Annule,
    Reporte
}

public class Rdv : BaseEntity
{
    public Guid Id { get; set; }
    public Guid CabinetIdentityId { get; set; }
    public CabinetIdentity? CabinetIdentity { get; set; }

    public Guid? PatientId { get; set; }
    public Patient? Patient { get; set; }

    public RdvStatus Status { get; set; } = RdvStatus.Confirme;
    public string Date { get; set; } = string.Empty; // Format YYYY-MM-DD
    public string Time { get; set; } = string.Empty; // Format HH:mm
    public int Duration { get; set; } = 15; // Duration in minutes (default 15)
    
    public string[]? Motifs { get; set; }

    // Personnel appointments
    public bool IsPersonnel { get; set; }
    public string? PersonnelDescription { get; set; }
    public int? PersonnelDuration { get; set; } // in minutes
}
