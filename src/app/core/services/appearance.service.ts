import { DOCUMENT } from '@angular/common';
import { effect, inject, Injectable, signal } from '@angular/core';

const APPEARANCE_STORAGE_KEY = 'logiflow.appearance.darkMode';

@Injectable({ providedIn: 'root' })
export class AppearanceService {
  private readonly document = inject(DOCUMENT);
  readonly isDark = signal(this.readInitialPreference());

  constructor() {
    effect(() => {
      const isDark = this.isDark();
      this.document.documentElement.classList.toggle('dark', isDark);
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(APPEARANCE_STORAGE_KEY, String(isDark));
        }
      } catch {
      }
    });
  }

  toggle(): void {
    this.isDark.update(isDark => !isDark);
  }

  setDark(isDark: boolean): void {
    this.isDark.set(isDark);
  }

  private readInitialPreference(): boolean {
    try {
      return typeof localStorage !== 'undefined' && localStorage.getItem(APPEARANCE_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  }
}
