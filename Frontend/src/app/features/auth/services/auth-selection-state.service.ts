import { Injectable } from '@angular/core';
import { LoginResponse } from '../../../core/models/auth.models';

interface PendingAuthSelection {
  credentials: {
    email: string;
    password: string;
  };
  loginData: LoginResponse;
}

const STORAGE_KEY = 'pending_auth_selection';

@Injectable({ providedIn: 'root' })
export class AuthSelectionStateService {
  private state: PendingAuthSelection | null = null;

  set(value: PendingAuthSelection): void {
    this.state = value;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  }

  get(): PendingAuthSelection | null {
    if (this.state) {
      return this.state;
    }

    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    try {
      this.state = JSON.parse(raw) as PendingAuthSelection;
      return this.state;
    } catch {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
  }

  clear(): void {
    this.state = null;
    sessionStorage.removeItem(STORAGE_KEY);
  }
}
