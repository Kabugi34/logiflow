import { effect, Injectable, signal } from '@angular/core';

const SIDEBAR_STORAGE_KEY = 'logiflow.layout.sidebarOpen';

@Injectable({ providedIn: 'root' })
export class LayoutService {
  readonly isSidebarOpen = signal(this.readInitialPreference());

  constructor() {
    effect(() => {
      const isSidebarOpen = this.isSidebarOpen();
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(SIDEBAR_STORAGE_KEY, String(isSidebarOpen));
        }
      } catch {
      }
    });
  }

  toggleSidebar(): void {
    this.isSidebarOpen.update(isSidebarOpen => !isSidebarOpen);
  }

  private readInitialPreference(): boolean {
    try {
      return typeof localStorage === 'undefined' || localStorage.getItem(SIDEBAR_STORAGE_KEY) !== 'false';
    } catch {
      return true;
    }
  }
}
