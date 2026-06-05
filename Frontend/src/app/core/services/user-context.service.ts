import { Injectable } from '@angular/core';
import { UserContext } from '../models/user-context.models';

const STORAGE_KEY = 'app_user_context';

@Injectable({ providedIn: 'root' })
export class UserContextService {
  private context: UserContext | null = null;

  set(context: UserContext): void {
    this.context = context;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(context));
  }

  get(): UserContext | null {
    if (this.context) {
      return this.context;
    }

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    try {
      this.context = JSON.parse(raw) as UserContext;
      return this.context;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
  }

  clear(): void {
    this.context = null;
    localStorage.removeItem(STORAGE_KEY);
  }
}
