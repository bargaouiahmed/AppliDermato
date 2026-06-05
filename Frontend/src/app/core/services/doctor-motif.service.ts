import { Injectable } from '@angular/core';
import { PREDEFINED_MOTIFS } from '../constants/motif.constants';
import { AuthService } from './auth.service';

const STORAGE_KEY_PREFIX = 'doctor_custom_motifs_v2';

@Injectable({ providedIn: 'root' })
export class DoctorMotifService {
  constructor(private readonly authService: AuthService) {}

  getPredefinedMotifs(): string[] {
    return [...PREDEFINED_MOTIFS];
  }

  getCustomMotifs(): string[] {
    if (typeof window === 'undefined') {
      return [];
    }

    const raw = window.localStorage.getItem(this.getScopedStorageKey());
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
        .sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
    } catch {
      return [];
    }
  }

  getAllMotifs(): string[] {
    const unique = new Map<string, string>();

    for (const motif of [...this.getPredefinedMotifs(), ...this.getCustomMotifs()]) {
      const normalized = this.normalizeMotifKey(motif);
      if (!normalized || unique.has(normalized)) {
        continue;
      }
      unique.set(normalized, motif.trim());
    }

    return [...unique.values()].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
  }

  addCustomMotif(value: string): { ok: boolean; reason?: 'invalid' | 'exists' } {
    const motif = value.trim();
    if (motif.length < 3 || motif.length > 100) {
      return { ok: false, reason: 'invalid' };
    }

    const all = this.getAllMotifs();
    if (all.some((existing) => existing.localeCompare(motif, 'fr', { sensitivity: 'base' }) === 0)) {
      return { ok: false, reason: 'exists' };
    }

    const customs = this.getCustomMotifs();
    customs.push(motif);
    this.persistCustomMotifs(customs);
    return { ok: true };
  }

  removeCustomMotif(value: string): void {
    const target = this.normalizeMotifKey(value);
    const filtered = this.getCustomMotifs().filter((motif) => this.normalizeMotifKey(motif) !== target);
    this.persistCustomMotifs(filtered);
  }

  isPredefined(value: string): boolean {
    return PREDEFINED_MOTIFS.some(
      (motif) => motif.localeCompare(value, 'fr', { sensitivity: 'base' }) === 0,
    );
  }

  private persistCustomMotifs(values: string[]): void {
    if (typeof window === 'undefined') {
      return;
    }

    const unique = new Map<string, string>();
    for (const value of values) {
      const trimmed = value.trim();
      if (!trimmed) {
        continue;
      }
      unique.set(this.normalizeMotifKey(trimmed), trimmed);
    }

    window.localStorage.setItem(this.getScopedStorageKey(), JSON.stringify([...unique.values()]));
  }

  private getScopedStorageKey(): string {
    const doctorScope = this.getDoctorScope();
    return `${STORAGE_KEY_PREFIX}:${doctorScope}`;
  }

  private getDoctorScope(): string {
    const token = this.authService.getAccessToken();
    if (!token) {
      return 'anonymous';
    }

    try {
      const [, payloadRaw] = token.split('.');
      if (!payloadRaw) {
        return 'anonymous';
      }

      const payload = payloadRaw.replace(/-/g, '+').replace(/_/g, '/');
      const padded = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), '=');
      const decoded = JSON.parse(atob(padded)) as Record<string, unknown>;

      const possibleClaims = [
        decoded['doctorId'],
        decoded['doctorid'],
        decoded['profileId'],
        decoded['profileid'],
        decoded['sub'],
        decoded['nameid'],
        decoded['id'],
      ];

      const firstStringClaim = possibleClaims.find(
        (claim): claim is string => typeof claim === 'string' && claim.trim() !== '',
      );

      return firstStringClaim?.trim() ?? 'anonymous';
    } catch {
      return 'anonymous';
    }
  }

  private normalizeMotifKey(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/œ/g, 'oe')
      .replace(/[’'`]/g, ' ')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }
}
