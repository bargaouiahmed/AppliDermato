using System;
using api.DatabaseRules;
using api.Src.Auth.Entities;

namespace api.Src.Subscription.Entities;

public class ActiveSubscription : BaseEntity
{
    public Guid Id { get; set; }
    public Guid CabinetIdentityId { get; set; }
    public CabinetIdentity? CabinetIdentity { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public int DurationInMonths { get; set; }
    public bool HasBeenNotifiedOfExpiration { get; set; } = false;
    public bool IsActive { get; set; } = true;
    public string SubscriptionType { get; set; } = "trial";


}
