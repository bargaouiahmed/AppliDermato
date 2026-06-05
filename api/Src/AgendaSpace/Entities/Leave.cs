using api.DatabaseRules;
using api.Src.Auth.Entities;

namespace api.Src.AgendaSpace.Entities;

public class Leave : BaseEntity
{
    public Guid Id { get; set; }
    public Guid CabinetIdentityId { get; set; }
    public CabinetIdentity? CabinetIdentity { get; set; }

    public string Date { get; set; } = string.Empty; // Format YYYY-MM-DD
    public bool IsFullDay { get; set; }
    public string? StartTime { get; set; } // Format HH:mm
    public string? EndTime { get; set; } // Format HH:mm
    
    public string Type { get; set; } = string.Empty; // annual, sick, personal, etc.
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsRecurring { get; set; } = false; // Repeat every year
}
