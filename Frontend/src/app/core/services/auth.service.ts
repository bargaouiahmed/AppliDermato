import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import {
  AuthenticatedAccountResponse,
  ChangeAutoAssignedPasswordRequest,
  LoginOptionsApiResponse,
  LoginRequest,
  LoginResponse,
  FinalizeAuthRequest,
  TokenResponse,
  SendPasswordResetCodeRequest,
  PasswordResetRequest,
  ApiMessageResponse,
} from '../models/auth.models';
import { CookieService } from './cookie.service';
import { API } from '../config/api.config';

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
/** Access token cookie lives 1 day (refresh middleware handles expiry) */
const ACCESS_TOKEN_DAYS = 1;
/** Refresh token cookie lives 7 days (matches backend) */
const REFRESH_TOKEN_DAYS = 7;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly cookie = new CookieService();

  constructor(private readonly http: HttpClient) {}

  login(request: LoginRequest): Observable<LoginResponse> {
    return this.http
      .post<LoginOptionsApiResponse>(API.auth.login, request)
      .pipe(map((response) => this.mapLoginResponse(response)));
  }

  finalizeAuth(request: FinalizeAuthRequest): Observable<TokenResponse> {
    return this.http.post<TokenResponse>(API.auth.finalizeAuth, request).pipe(
      tap((res) => this.storeTokens(res)),
    );
  }

  sendPasswordResetCode(request: SendPasswordResetCodeRequest): Observable<ApiMessageResponse> {
    return this.http.get<ApiMessageResponse>(
      API.auth.sendResetCode(request.email, request.language ?? 'fr'),
    );
  }

  resetPassword(request: PasswordResetRequest): Observable<ApiMessageResponse> {
    return this.http.post<ApiMessageResponse>(API.auth.resetPassword, request);
  }

  changeAutoAssignedPassword(
    request: ChangeAutoAssignedPasswordRequest,
  ): Observable<TokenResponse> {
    return this.http
      .put<TokenResponse>(API.auth.changeAutoAssignedPassword, request)
      .pipe(tap((res) => this.storeTokens(res)));
  }

  refreshToken(refreshToken: string): Observable<TokenResponse> {
    return this.http
      .post<TokenResponse>(API.auth.refreshToken, { refreshToken })
      .pipe(tap((res) => this.storeTokens(res)));
  }

  getAuthenticatedAccount(): Observable<AuthenticatedAccountResponse> {
    return this.http.get<AuthenticatedAccountResponse>(API.auth.me);
  }

  storeTokens(tokens: TokenResponse): void {
    this.cookie.set(ACCESS_TOKEN_KEY, tokens.accessToken, ACCESS_TOKEN_DAYS);
    this.cookie.set(REFRESH_TOKEN_KEY, tokens.refreshToken, REFRESH_TOKEN_DAYS);
  }

  getAccessToken(): string | null {
    return this.cookie.get(ACCESS_TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return this.cookie.get(REFRESH_TOKEN_KEY);
  }

  logout(): void {
    this.cookie.remove(ACCESS_TOKEN_KEY);
    this.cookie.remove(REFRESH_TOKEN_KEY);
  }

  isLoggedIn(): boolean {
    const token = this.getAccessToken();
    if (!token) {
      return false;
    }

    return !this.isTokenExpired(token);
  }

  getTokenRole(): string | null {
    const token = this.getAccessToken();
    if (!token) {
      return null;
    }

    const payload = this.decodeJwtPayload(token);
    if (!payload) {
      return null;
    }

    const roleClaim =
      payload['role'] ??
      payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];

    if (typeof roleClaim !== 'string' || roleClaim.trim() === '') {
      return null;
    }

    return this.normalizeRole(roleClaim);
  }

  hasAnyRole(roles: string[]): boolean {
    const tokenRole = this.getTokenRole();
    if (!tokenRole) {
      return false;
    }

    const normalizedAllowed = roles.map((role) => this.normalizeRole(role));
    return normalizedAllowed.includes(tokenRole);
  }

  requiresAutoPasswordChange(): boolean {
    const tokenRole = this.getTokenRole();
    return tokenRole ? tokenRole.endsWith('_auto_pass_unchanged') : false;
  }

  private decodeJwtPayload(token: string): Record<string, unknown> | null {
    try {
      const parts = token.split('.');
      if (parts.length < 2) {
        return null;
      }

      const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), '=');
      const decoded = atob(padded);
      return JSON.parse(decoded) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private isTokenExpired(token: string): boolean {
    const payload = this.decodeJwtPayload(token);
    if (!payload) {
      return true;
    }

    const exp = payload['exp'];
    if (typeof exp !== 'number') {
      return false;
    }

    const nowInSeconds = Math.floor(Date.now() / 1000);
    return exp <= nowInSeconds;
  }

  private normalizeRole(role: string): string {
    const normalized = role.trim().toLowerCase();

    if (normalized === 'superadmin') {
      return 'super_admin';
    }

    if (normalized === 'medecin') {
      return 'doctor';
    }

    if (normalized === 'secretaire1' || normalized === 'secretaire2') {
      return 'secretary';
    }

    return normalized;
  }

  private mapLoginResponse(response: LoginOptionsApiResponse): LoginResponse {
    const secretaries = (response.secretaries ?? [])
      .slice()
      .sort((a, b) => (a.index ?? 99) - (b.index ?? 99));
    const firstSecretary = secretaries[0];
    const secondSecretary = secretaries[1];

    return {
      id: '',
      firstName: response.doctorFirstname ?? '',
      lastName: response.doctorLastname ?? '',
      firstSecretary: firstSecretary
        ? {
            id: firstSecretary.id,
            firstName: firstSecretary.firstname,
            lastName: firstSecretary.lastname,
            doctorId: '',
            index: firstSecretary.index,
          }
        : null,
      secondSecretary: secondSecretary
        ? {
            id: secondSecretary.id,
            firstName: secondSecretary.firstname,
            lastName: secondSecretary.lastname,
            doctorId: '',
            index: secondSecretary.index,
          }
        : null,
      isSecondSecretaryEnabled: Boolean(response.isSecondSecretaryActive && secondSecretary),
    };
  }
}
