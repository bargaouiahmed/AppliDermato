using Microsoft.AspNetCore.Http;

namespace api.Src.TechAssistance.Dtos;

public class CreateTechAssistanceTicketRequest
{
    public string? Subject { get; set; }
    public string? Message { get; set; }
    public List<IFormFile>? Attachments { get; set; }
}

public class CreateTechAssistanceMessageRequest
{
    public string? Message { get; set; }
    public List<IFormFile>? Attachments { get; set; }
}

public class TechLeadReviewRequest
{
    public string Password { get; set; } = string.Empty;
}

public class TechAssistanceUnreadCountResponse
{
    public int Count { get; set; }
}

public class TechAssistanceAttachmentResponse
{
    public Guid Id { get; set; }
    public Guid MessageId { get; set; }
    public string OriginalFileName { get; set; } = string.Empty;
    public string FileUrl { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long FileSizeBytes { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class TechAssistanceParticipantResponse
{
    public Guid DoctorId { get; set; }
    public Guid CabinetIdentityId { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
}

public class TechAssistanceMessageResponse
{
    public Guid Id { get; set; }
    public Guid TicketId { get; set; }
    public Guid SenderDoctorId { get; set; }
    public Guid SenderCabinetIdentityId { get; set; }
    public string SenderFirstName { get; set; } = string.Empty;
    public string SenderLastName { get; set; } = string.Empty;
    public string SenderEmail { get; set; } = string.Empty;
    public string SenderRole { get; set; } = string.Empty;
    public string SenderDisplayName { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public bool ReadByRequester { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<TechAssistanceAttachmentResponse> Attachments { get; set; } = [];
}

public class TechAssistanceTicketResponse
{
    public Guid Id { get; set; }
    public Guid CabinetIdentityId { get; set; }
    public Guid DoctorId { get; set; }
    public string DoctorFirstName { get; set; } = string.Empty;
    public string DoctorLastName { get; set; } = string.Empty;
    public string DoctorEmail { get; set; } = string.Empty;
    public string DoctorDisplayName { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public bool SeenByAdmins { get; set; }
    public DateTime? LastMessageAt { get; set; }
    public DateTime? LastDoctorMessageAt { get; set; }
    public DateTime? LastAdminMessageAt { get; set; }
    public DateTime? TechLeadNotifiedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public List<TechAssistanceParticipantResponse> Participants { get; set; } = [];
    public List<TechAssistanceMessageResponse> Messages { get; set; } = [];
}
