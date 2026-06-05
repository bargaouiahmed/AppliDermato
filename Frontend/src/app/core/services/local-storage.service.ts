import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LocalStorageService {
  get(name: string): string | null {
    try {
      return localStorage.getItem(name);
    } catch (error) {
      console.error(`Error reading from localStorage for key "${name}":`, error);
      return null;
    }
  }

  set(name: string, value: string): void {
    try {
      localStorage.setItem(name, value);
    } catch (error) {
      console.error(`Error writing to localStorage for key "${name}":`, error);
    }
  }

  remove(name: string): void {
    try {
      localStorage.removeItem(name);
    } catch (error) {
      console.error(`Error removing from localStorage for key "${name}":`, error);
    }
  }

  clear(): void {
    try {
      localStorage.clear();
    } catch (error) {
      console.error('Error clearing localStorage:', error);
    }
  }
}
