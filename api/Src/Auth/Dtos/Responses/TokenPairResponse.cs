using System;

namespace api.Src.Auth.Dtos.Requests;

public class TokenPairResponse
{
    public required string AccessToken { get; set; }
    public required string RefreshToken { get; set; }
    public Guid? IdentityId { get; set; }
    public Guid? ProfileId { get; set; }
    public string? Role { get; set; }

}
