namespace api.Src.Admin.Dtos.Requests;

public class ChangeDoctorRoleRequest
{
    public required string Role { get; set; }
    public int? SubscriptionDurationInMonths { get; set; }
}
