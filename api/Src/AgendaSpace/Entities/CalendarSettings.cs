using api.DatabaseRules;
using api.Src.Auth.Entities;

namespace api.Src.AgendaSpace.Entities;

public class CalendarSettings : BaseEntity
{
    public Guid Id { get; set; }
    public Guid CabinetIdentityId { get; set; }
    public CabinetIdentity? CabinetIdentity { get; set; }

    public int StartHour { get; set; } = 8;
    public int EndHour { get; set; } = 17;
    public int TimeSlotInterval { get; set; } = 15;
}
