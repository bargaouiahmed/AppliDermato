using System.Security.Claims;

namespace api.Src.Auth.Helpers;

public static class UserClaimsExtensions
{
    private static readonly string[] CabinetIdentityClaimTypes =
    [
        ClaimTypes.NameIdentifier,
        "nameid",
        "sub",
        "nameidentifier",
        "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"
    ];

    private static readonly string[] RoleClaimTypes =
    [
        ClaimTypes.Role,
        "role",
        "http://schemas.microsoft.com/ws/2008/06/identity/claims/role"
    ];

    public static Guid GetCabinetIdentityId(this ClaimsPrincipal user)
    {
        foreach (var claimType in CabinetIdentityClaimTypes)
        {
            var rawValue = user.FindFirstValue(claimType);
            if (Guid.TryParse(rawValue, out var cabinetIdentityId))
            {
                return cabinetIdentityId;
            }
        }

        throw new InvalidOperationException("Cabinet identity claim not found in JWT.");
    }

    public static string GetRoleOrThrow(this ClaimsPrincipal user)
    {
        foreach (var claimType in RoleClaimTypes)
        {
            var role = user.FindFirstValue(claimType);
            if (!string.IsNullOrWhiteSpace(role))
            {
                return role;
            }
        }

        throw new InvalidOperationException("Role claim not found in JWT.");
    }
}
