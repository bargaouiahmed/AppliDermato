using System;
using api.Src.Auth.Dtos;
using api.Src.Auth.Dtos.Requests;
using api.Src.Auth.Dtos.Responses;

namespace api.Src.Auth.Services;

public interface IAuthService
{
    public Task EnsureSuperAdminExists();
    public Task<TokenPairResponse> SignIn(SignInRequestWithRole request);
    public Task<LoginOptionsResponse> GetAccountsForCabinet(SignInRequest request);
    public Task<TokenPairResponse> RefreshToken(string refreshToken, Guid id, string role);
    public Task SendPasswordResetEmail(string email, string languagePreference = "fr");
    public Task ResetPassword(ResetPasswordRequest request);
    public Task<SerializedDoctorProfile> GetAuthenticatedDoctorAccount(Guid identityId, string role);
    public Task<TokenPairResponse> ChangeAutoAssignedPassword(Guid identityId, ChangeAutoAssignedPasswordRequest request);
}
