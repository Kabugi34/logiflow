import { computed, effect, Injectable, signal } from '@angular/core';

const SIDEBAR_STORAGE_KEY = 'logiflow.layout.sidebarOpen';

@Injectable({ providedIn: 'root' })
export class LayoutService {
  readonly isSidebarOpen = signal(this.readInitialPreference());
  readonly isMobileNavOpen = signal(false);
  readonly isMobileViewport = signal(false);
  readonly isExpanded = computed(() =>
    this.isMobileViewport() ? this.isMobileNavOpen() : this.isSidebarOpen(),
  );

  constructor() {
    this.syncViewport();
    if (typeof window !== 'undefined') window.addEventListener('resize', this.syncViewport);
    effect(() => {
      const isSidebarOpen = this.isSidebarOpen();
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(SIDEBAR_STORAGE_KEY, String(isSidebarOpen));
        }
      } catch {}
    });
  }

  toggleSidebar(): void {
    if (this.isMobileViewport()) {
      this.isMobileNavOpen.update((open) => !open);
      return;
    }
    this.isSidebarOpen.update((open) => !open);
  }

  closeMobileNav(): void {
    this.isMobileNavOpen.set(false);
  }

  private readonly syncViewport = (): void => {
    if (typeof window === 'undefined') return;
    const mobile = window.matchMedia('(max-width: 767px)').matches;
    this.isMobileViewport.set(mobile);
    if (!mobile) this.isMobileNavOpen.set(false);
  };

  private readInitialPreference(): boolean {
    try {
      return (
        typeof localStorage === 'undefined' || localStorage.getItem(SIDEBAR_STORAGE_KEY) !== 'false'
      );
    } catch {
      return true;
    }
  }
}
