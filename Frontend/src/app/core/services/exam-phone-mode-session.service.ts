import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

const PHONE_MODE_PREVIOUS_TOKENS_KEY = 'exam_phone_mode_previous_tokens';
const PHONE_MODE_CLEANUP_STRATEGY_KEY = 'exam_phone_mode_cleanup_strategy';

type PhoneModeCleanupStrategy = 'none' | 'clear' | 'restore_previous';

export interface PhoneModeLaunchTokens {
  accessToken: string;
  refreshToken: string;
}

export interface PhoneModeSessionPreparationResult {
  ok: boolean;
  requiredDoctorId: string | null;
  errorKey?: string;
}

@Injectable({ providedIn: 'root' })
export class ExamPhoneModeSessionService {
  constructor(private readonly auth: AuthService) {}

  enablePhoneModeStorage(): void {
    this.auth.setStorageMode('localStorage');
  }

  disablePhoneModeStorage(): void {
    this.auth.clearStorageMode();
  }

  isMobileDevice(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    const compactWidth = window.matchMedia('(max-width: 1024px)').matches;
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
    const touchPoints = navigator.maxTouchPoints > 0;
    return compactWidth && (coarsePointer || touchPoints);
  }

  buildLaunchUrl(consultationId: string): string {
    const tokens =
      this.auth.getTokenPair('cookie') ??
      this.auth.getTokenPair('localStorage') ??
      (() => {
        throw new Error('No active auth tokens available for phone mode.');
      })();

    const baseUrl =
      environment.appUrl?.trim().replace(/\/+$/, '') ||
      (typeof window !== 'undefined' ? window.location.origin.replace(/\/+$/, '') : '');

    const hashParams = new URLSearchParams({
      a: tokens.accessToken,
      r: tokens.refreshToken,
    });

    return `${baseUrl}/consultations/${consultationId}/phone-mode#${hashParams.toString()}`;
  }

  consumeLaunchTokensFromHash(): PhoneModeLaunchTokens | null {
    if (typeof window === 'undefined') {
      return null;
    }

    const hash = window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.hash;
    if (!hash) {
      return null;
    }

    const params = new URLSearchParams(hash);
    const accessToken = params.get('a')?.trim() ?? '';
    const refreshToken = params.get('r')?.trim() ?? '';

    if (!accessToken || !refreshToken) {
      return null;
    }

    this.clearLaunchHash();
    return {
      accessToken,
      refreshToken,
    };
  }

  prepareSession(launchTokens: PhoneModeLaunchTokens | null): PhoneModeSessionPreparationResult {
    this.enablePhoneModeStorage();

    if (launchTokens) {
      return this.prepareQrSession(launchTokens);
    }

    const localTokens = this.auth.getTokenPair('localStorage');
    if (localTokens?.accessToken && !this.auth.isTokenExpired(localTokens.accessToken)) {
      this.ensureCleanupStrategy('none');
      return {
        ok: true,
        requiredDoctorId: this.auth.getTokenProfileIdFromToken(localTokens.accessToken),
      };
    }

    const cookieTokens = this.auth.getTokenPair('cookie');
    if (cookieTokens?.accessToken && !this.auth.isTokenExpired(cookieTokens.accessToken)) {
      this.auth.storeTokens(cookieTokens, 'localStorage');
      this.ensureCleanupStrategy('clear');
      return {
        ok: true,
        requiredDoctorId: this.auth.getTokenProfileIdFromToken(cookieTokens.accessToken),
      };
    }

    this.resetStoredPhoneModeState();
    return {
      ok: false,
      requiredDoctorId: null,
      errorKey: 'consultation.page.exam.phone.scanRequired',
    };
  }

  cleanupSession(): void {
    const strategy = this.readCleanupStrategy();
    if (strategy === 'restore_previous') {
      const previousTokens = this.readPreviousTokens();
      if (previousTokens) {
        this.auth.storeTokens(previousTokens, 'localStorage');
      } else {
        this.auth.logout('localStorage');
      }
    } else if (strategy === 'clear') {
      this.auth.logout('localStorage');
    }

    this.resetStoredPhoneModeState();
    this.disablePhoneModeStorage();
  }

  private prepareQrSession(launchTokens: PhoneModeLaunchTokens): PhoneModeSessionPreparationResult {
    const requiredDoctorId = this.auth.getTokenProfileIdFromToken(launchTokens.accessToken);
    const tokenRole = this.auth.getTokenRoleFromToken(launchTokens.accessToken);

    if (!requiredDoctorId || !tokenRole || !['doctor', 'admin', 'super_admin'].includes(tokenRole)) {
      this.resetStoredPhoneModeState();
      return {
        ok: false,
        requiredDoctorId: null,
        errorKey: 'consultation.page.exam.phone.invalidSession',
      };
    }

    const existingLocalTokens = this.auth.getTokenPair('localStorage');
    const existingLocalDoctorId = this.auth.getTokenProfileId('localStorage');

    if (
      existingLocalTokens?.accessToken &&
      !this.auth.isTokenExpired(existingLocalTokens.accessToken) &&
      existingLocalDoctorId === requiredDoctorId
    ) {
      this.ensureCleanupStrategy('none');
      return {
        ok: true,
        requiredDoctorId,
      };
    }

    if (existingLocalTokens?.accessToken && !this.auth.isTokenExpired(existingLocalTokens.accessToken)) {
      this.writePreviousTokens(existingLocalTokens);
      this.writeCleanupStrategy('restore_previous');
    } else {
      this.clearPreviousTokens();
      this.writeCleanupStrategy('clear');
    }

    this.auth.storeTokens(launchTokens, 'localStorage');

    return {
      ok: true,
      requiredDoctorId,
    };
  }

  private clearLaunchHash(): void {
    if (typeof window === 'undefined') {
      return;
    }

    const cleanUrl = `${window.location.pathname}${window.location.search}`;
    window.history.replaceState(window.history.state, document.title, cleanUrl);
  }

  private ensureCleanupStrategy(fallback: PhoneModeCleanupStrategy): void {
    if (!this.readCleanupStrategy()) {
      this.writeCleanupStrategy(fallback);
    }
  }

  private readCleanupStrategy(): PhoneModeCleanupStrategy | null {
    try {
      const value = sessionStorage.getItem(PHONE_MODE_CLEANUP_STRATEGY_KEY);
      return value === 'clear' || value === 'restore_previous' || value === 'none'
        ? value
        : null;
    } catch {
      return null;
    }
  }

  private writeCleanupStrategy(strategy: PhoneModeCleanupStrategy): void {
    try {
      sessionStorage.setItem(PHONE_MODE_CLEANUP_STRATEGY_KEY, strategy);
    } catch {
      // ignore storage failures
    }
  }

  private readPreviousTokens(): { accessToken: string; refreshToken: string } | null {
    try {
      const raw = sessionStorage.getItem(PHONE_MODE_PREVIOUS_TOKENS_KEY);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const accessToken = typeof parsed['accessToken'] === 'string' ? parsed['accessToken'] : '';
      const refreshToken = typeof parsed['refreshToken'] === 'string' ? parsed['refreshToken'] : '';
      if (!accessToken || !refreshToken) {
        return null;
      }

      return { accessToken, refreshToken };
    } catch {
      return null;
    }
  }

  private writePreviousTokens(tokens: { accessToken: string; refreshToken: string }): void {
    try {
      sessionStorage.setItem(PHONE_MODE_PREVIOUS_TOKENS_KEY, JSON.stringify(tokens));
    } catch {
      // ignore storage failures
    }
  }

  private clearPreviousTokens(): void {
    try {
      sessionStorage.removeItem(PHONE_MODE_PREVIOUS_TOKENS_KEY);
    } catch {
      // ignore storage failures
    }
  }

  private resetStoredPhoneModeState(): void {
    this.clearPreviousTokens();

    try {
      sessionStorage.removeItem(PHONE_MODE_CLEANUP_STRATEGY_KEY);
    } catch {
      // ignore storage failures
    }
  }
}
