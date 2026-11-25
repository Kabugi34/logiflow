import { Component, HostListener, effect, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly auth = inject(AuthService);
  protected readonly sessionActionError = signal('');

  constructor() {
    effect(() => {
      const ended = this.auth.sessionEnd();
      if (!ended) return;
      const params = new URLSearchParams({ session: ended.reason });
      if (ended.workspace) params.set('workspace', ended.workspace.toLowerCase());
      if (typeof window !== 'undefined') window.location.replace(`/auth/login?${params.toString()}`);
    });
  }

  @HostListener('document:pointerdown', ['$event'])
  protected pointerActivity(event: PointerEvent): void {
    if (!this.isSessionControl(event.target)) this.noteActivity();
  }

  @HostListener('document:keydown', ['$event'])
  @HostListener('document:touchstart', ['$event'])
  @HostListener('document:wheel', ['$event'])
  protected inputActivity(event: Event): void {
    if (!this.isSessionControl(event.target)) this.noteActivity();
  }

  protected staySignedIn(): void {
    this.sessionActionError.set('');
    this.auth.staySignedIn().subscribe({
      next: (valid) => { if (valid) this.auth.noteUserActivity(); },
      error: () => this.sessionActionError.set('Your session could not be confirmed. Please try again or sign out.'),
    });
  }

  protected signOut(): void {
    this.sessionActionError.set('');
    this.auth.logout().subscribe();
  }

  protected hasUnsavedFormChanges(): boolean {
    return typeof document !== 'undefined' && document.querySelector('form .ng-dirty') !== null;
  }

  @HostListener('window:beforeunload', ['$event'])
  protected protectUnsavedChanges(event: BeforeUnloadEvent): void {
    if (this.auth.sessionEnd() || !this.hasUnsavedFormChanges()) return;
    event.preventDefault();
    event.returnValue = '';
  }

  private noteActivity(): void {
    this.sessionActionError.set('');
    this.auth.noteUserActivity();
  }

  private isSessionControl(target: EventTarget | null): boolean {
    return target instanceof Element && !!target.closest('[data-session-control]');
  }
}
