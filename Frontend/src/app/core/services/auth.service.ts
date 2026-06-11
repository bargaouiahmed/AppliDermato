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
const PHONE_ACCESS_TOKEN_KEY = 'phone_mode_access_token';
const PHONE_REFRESH_TOKEN_KEY = 'phone_mode_refresh_token';
const AUTH_STORAGE_MODE_KEY = 'auth_storage_mode';
/** Access token cookie lives 1 day (refresh middleware handles expiry) */
const ACCESS_TOKEN_DAYS = 1;
/** Refresh token cookie lives 7 days (matches backend) */
const REFRESH_TOKEN_DAYS = 7;

export type AuthStorageMode = 'cookie' | 'localStorage';

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

  setStorageMode(mode: AuthStorageMode): void {
    try {
      sessionStorage.setItem(AUTH_STORAGE_MODE_KEY, mode);
    } catch {
      // ignore storage failures
    }
  }

  clearStorageMode(): void {
    try {
      sessionStorage.removeItem(AUTH_STORAGE_MODE_KEY);
    } catch {
      // ignore storage failures
    }
  }

  getStorageMode(): AuthStorageMode {
    try {
      return sessionStorage.getItem(AUTH_STORAGE_MODE_KEY) === 'localStorage'
        ? 'localStorage'
        : 'cookie';
    } catch {
      return 'cookie';
    }
  }

  storeTokens(tokens: TokenResponse, mode: AuthStorageMode = this.getStorageMode()): void {
    if (mode === 'localStorage') {
      this.writeLocalStorage(PHONE_ACCESS_TOKEN_KEY, tokens.accessToken);
      this.writeLocalStorage(PHONE_REFRESH_TOKEN_KEY, tokens.refreshToken);
      return;
    }

    this.cookie.set(ACCESS_TOKEN_KEY, tokens.accessToken, ACCESS_TOKEN_DAYS);
    this.cookie.set(REFRESH_TOKEN_KEY, tokens.refreshToken, REFRESH_TOKEN_DAYS);
  }

  getAccessToken(mode: AuthStorageMode = this.getStorageMode()): string | null {
    return mode === 'localStorage'
      ? this.readLocalStorage(PHONE_ACCESS_TOKEN_KEY)
      : this.cookie.get(ACCESS_TOKEN_KEY);
  }

  getRefreshToken(mode: AuthStorageMode = this.getStorageMode()): string | null {
    return mode === 'localStorage'
      ? this.readLocalStorage(PHONE_REFRESH_TOKEN_KEY)
      : this.cookie.get(REFRESH_TOKEN_KEY);
  }

  getTokenPair(mode: AuthStorageMode = this.getStorageMode()): TokenResponse | null {
    const accessToken = this.getAccessToken(mode);
    const refreshToken = this.getRefreshToken(mode);
    if (!accessToken || !refreshToken) {
      return null;
    }

    return {
      accessToken,
      refreshToken,
    };
  }

  logout(mode: AuthStorageMode = this.getStorageMode()): void {
    if (mode === 'localStorage') {
      this.removeLocalStorage(PHONE_ACCESS_TOKEN_KEY);
      this.removeLocalStorage(PHONE_REFRESH_TOKEN_KEY);
      return;
    }

    this.cookie.remove(ACCESS_TOKEN_KEY);
    this.cookie.remove(REFRESH_TOKEN_KEY);
  }

  isLoggedIn(mode: AuthStorageMode = this.getStorageMode()): boolean {
    const token = this.getAccessToken(mode);
    if (!token) {
      return false;
    }

    return !this.isTokenExpired(token);
  }

  getTokenRole(mode: AuthStorageMode = this.getStorageMode()): string | null {
    return this.getTokenRoleFromToken(this.getAccessToken(mode));
  }

  getTokenRoleFromToken(token: string | null | undefined): string | null {
    if (!token) {
      return null;
    }

    const payload = this.getJwtPayload(token);
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

  getTokenProfileId(mode: AuthStorageMode = this.getStorageMode()): string | null {
    return this.getTokenProfileIdFromToken(this.getAccessToken(mode));
  }

  getTokenProfileIdFromToken(token: string | null | undefined): string | null {
    const payload = this.getJwtPayload(token);
    const profileId = payload?.['profile_id'];
    return typeof profileId === 'string' && profileId.trim() ? profileId.trim() : null;
  }

  getJwtPayload(token: string | null | undefined): Record<string, unknown> | null {
    if (!token) {
      return null;
    }

    return this.decodeJwtPayload(token);
  }

  hasAnyRole(roles: string[], mode: AuthStorageMode = this.getStorageMode()): boolean {
    const tokenRole = this.getTokenRole(mode);
    if (!tokenRole) {
      return false;
    }

    const normalizedAllowed = roles.map((role) => this.normalizeRole(role));
    return normalizedAllowed.includes(tokenRole);
  }

  requiresAutoPasswordChange(mode: AuthStorageMode = this.getStorageMode()): boolean {
    const tokenRole = this.getTokenRole(mode);
    return tokenRole ? tokenRole.endsWith('_auto_pass_unchanged') : false;
  }

  isTokenExpired(token: string | null | undefined): boolean {
    if (!token) {
      return true;
    }

    return this.isJwtTokenExpired(token);
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

  private isJwtTokenExpired(token: string): boolean {
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

  private readLocalStorage(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private writeLocalStorage(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // ignore storage failures
    }
  }

  private removeLocalStorage(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore storage failures
    }
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
