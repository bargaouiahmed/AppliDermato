namespace api.Src.Messaging.Dtos;

public class InternalMessagingBootstrapResponse
{
    public Guid CabinetIdentityId { get; set; }
    public Guid DoctorId { get; set; }
    public string CurrentSender { get; set; } = string.Empty;
    public bool HasSecondSecretary { get; set; }
    public bool IsSecondSecretaryActive { get; set; }
    public List<InternalMessagingRoomResponse> Rooms { get; set; } = [];
}

public class InternalMessagingRoomResponse
{
    public string Key { get; set; } = string.Empty;
    public string RoomId { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public bool IsGroup { get; set; }
    public int UnreadCount { get; set; }
}

public class InternalMessageResponse
{
    public Guid Id { get; set; }
    public Guid CabinetIdentityId { get; set; }
    public string RoomId { get; set; } = string.Empty;
    public string Sender { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public DateTime? EditedAt { get; set; }
    public DateTime? DeletedAt { get; set; }
    public string[] SeenBy { get; set; } = [];
    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class SendInternalMessageRequest
{
    public string RoomId { get; set; } = string.Empty;
    public string? Sender { get; set; }
    public string Content { get; set; } = string.Empty;
}

public class EditInternalMessageRequest
{
    public string? Sender { get; set; }
    public string Content { get; set; } = string.Empty;
}

public class DeleteInternalMessageRequest
{
    public string? Sender { get; set; }
}

public class MarkInternalRoomSeenRequest
{
    public string? Viewer { get; set; }
}

public class InternalMessagingTypingPayload
{
    public string RoomId { get; set; } = string.Empty;
    public string? Sender { get; set; }
}
