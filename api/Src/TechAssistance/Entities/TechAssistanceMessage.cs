using api.DatabaseRules;

namespace api.Src.TechAssistance.Entities;

public class TechAssistanceMessage : BaseEntity
{
    public Guid Id { get; set; }
    public Guid TechAssistanceTicketId { get; set; }
    public TechAssistanceTicket? Ticket { get; set; }
    public Guid SenderDoctorId { get; set; }
    public Guid SenderCabinetIdentityId { get; set; }
    public string SenderFirstName { get; set; } = string.Empty;
    public string SenderLastName { get; set; } = string.Empty;
    public string SenderEmail { get; set; } = string.Empty;
    public string SenderRole { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public bool ReadByRequester { get; set; }
    public DateTime? ReadByRequesterAt { get; set; }
    public ICollection<TechAssistanceAttachment> Attachments { get; set; } = [];
}
