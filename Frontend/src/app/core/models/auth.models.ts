export interface LoginRequest {
  email: string;
  password: string;
}

export interface Secretary {
  id: string;
  firstName: string;
  lastName: string;
  doctorId: string;
  index: number;
}

export interface LoginResponse {
  id: string;
  firstName: string;
  lastName: string;
  firstSecretary: Secretary | null;
  secondSecretary: Secretary | null;
  isSecondSecretaryEnabled: boolean;
}

export interface FinalizeAuthRequest {
  email: string;
  password: string;
  role: 'doctor' | 'secretary1' | 'secretary2';
}

export interface ChangeAutoAssignedPasswordRequest {
  oldPassword: string;
  newPassword: string;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  identityId?: string;
  profileId?: string;
  role?:
    | 'doctor'
    | 'admin'
    | 'super_admin'
    | 'secretary'
    | 'doctor_auto_pass_unchanged'
    | 'admin_auto_pass_unchanged'
    | string;
}

export interface SendPasswordResetCodeRequest {
  email: string;
  language?: string; // 'fr' | 'en' | 'ar', defaults to 'fr'
}

export interface PasswordResetRequest {
  email: string;
  newPassword: string;
  resetToken: string;
}

export interface ApiMessageResponse {
  message: string;
}

export interface LoginOptionsApiResponse {
  doctorFirstname: string;
  doctorLastname: string;
  isSecondSecretaryActive?: boolean;
  secretaries?: LoginSecretaryApiResponse[] | null;
}

export interface LoginSecretaryApiResponse {
  firstname: string;
  lastname: string;
  id: string;
  index: number;
}

export interface AuthenticatedAccountResponse {
  id: string;
  doctorId: string;
  firstname: string;
  lastname: string;
  email: string;
  role: string;
}
