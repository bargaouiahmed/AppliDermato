namespace api.Src.Suggestions.Dtos;

public class CreateSuggestionRequest
{
    public string Subject { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
}

public class ReplyToSuggestionRequest
{
    public string Message { get; set; } = string.Empty;
}

public class SuggestionUnreadCountResponse
{
    public int Count { get; set; }
}

public class SuggestionReplyResponse
{
    public Guid Id { get; set; }
    public Guid SuggestionId { get; set; }
    public Guid ResponderDoctorId { get; set; }
    public string ResponderFirstName { get; set; } = string.Empty;
    public string ResponderLastName { get; set; } = string.Empty;
    public string ResponderRole { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public bool ReadByDoctor { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class SuggestionResponse
{
    public Guid Id { get; set; }
    public Guid CabinetIdentityId { get; set; }
    public Guid DoctorId { get; set; }
    public string DoctorFirstName { get; set; } = string.Empty;
    public string DoctorLastName { get; set; } = string.Empty;
    public string DoctorEmail { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public bool SeenByAdmins { get; set; }
    public DateTime? LastReplyAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public List<SuggestionReplyResponse> Replies { get; set; } = [];
}
