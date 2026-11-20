import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { AuthenticatedImageComponent } from '../../shared/authenticated-image.component';
import { ProfileService, UserProfile } from './profile.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [RouterLink, AuthenticatedImageComponent],
  template: `
    <section class="mx-auto max-w-3xl space-y-5">
      <header class="border-b border-slate-200 pb-4">
        <p class="text-xs font-medium uppercase tracking-[0.18em] text-blue-600">Account</p>
        <h1 class="mt-1 text-2xl font-semibold text-slate-900">Your profile</h1>
        <p class="mt-1 text-sm text-slate-500">Update your profile photo. Account and organization details are managed through onboarding.</p>
      </header>

      @if (loading()) {
        <p role="status" class="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">Loading your profile…</p>
      } @else if (profile(); as current) {
        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div class="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div class="h-24 w-24 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-50">
              @if (current.avatarUrl) {
                <app-authenticated-image [src]="current.avatarUrl" [alt]="current.fullName + ' profile photo'" fallback="No photo" fit="cover" />
              } @else {
                <div class="grid h-full w-full place-items-center text-2xl font-semibold text-slate-400">{{ initials() }}</div>
              }
            </div>
            <div class="min-w-0 flex-1">
              <h2 class="font-semibold text-slate-900">Profile photo</h2>
              <p class="mt-1 text-sm text-slate-500">PNG, JPEG, or WebP. Maximum size 5 MB.</p>
              <label class="mt-3 inline-flex min-h-10 cursor-pointer items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-blue-600" [class.opacity-60]="avatarBusy()">
                {{ avatarBusy() ? 'Uploading…' : current.avatarUrl ? 'Replace photo' : 'Upload photo' }}
                <input class="sr-only" type="file" accept="image/png,image/jpeg,image/webp" [disabled]="avatarBusy()" (change)="chooseAvatar($event)" />
              </label>
              @if (avatarBusy()) {
                <div class="mt-3" role="status" aria-live="polite">
                  <p class="text-sm text-blue-700">{{ uploadProgress() === null ? 'Uploading your photo…' : 'Uploading… ' + uploadProgress() + '%' }}</p>
                  @if (uploadProgress() !== null) { <progress class="mt-1 h-2 w-full accent-blue-600" [value]="uploadProgress()!" max="100">{{ uploadProgress() }}%</progress> }
                </div>
              }
              @if (avatarError()) { <p class="mt-2 text-sm text-red-700" role="alert">{{ avatarError() }}</p> }
            </div>
          </div>
        </div>

        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 class="font-semibold text-slate-900">Account details</h2>
          <dl class="mt-4 grid gap-4 sm:grid-cols-2">
            <div><dt class="text-xs font-medium text-slate-500">Full name</dt><dd class="mt-1 break-words text-sm text-slate-900">{{ current.fullName || 'Unavailable' }}</dd></div>
            <div><dt class="text-xs font-medium text-slate-500">Email</dt><dd class="mt-1 break-all text-sm text-slate-900">{{ current.email || 'Unavailable' }}</dd></div>
            <div><dt class="text-xs font-medium text-slate-500">Phone number</dt><dd class="mt-1 break-words text-sm text-slate-900">{{ current.phoneNumber || 'Unavailable' }}</dd></div>
            <div><dt class="text-xs font-medium text-slate-500">Organization</dt><dd class="mt-1 break-words text-sm text-slate-900">{{ auth.user()?.organization?.name || 'Unavailable' }}</dd></div>
            <div><dt class="text-xs font-medium text-slate-500">Workspace</dt><dd class="mt-1 text-sm text-slate-900">{{ auth.user()?.organization?.type === 'DISTRIBUTOR' ? 'Distributor' : 'Manufacturer' }}</dd></div>
          </dl>
          <p class="mt-4 text-xs text-slate-500">These details are read-only to preserve the organization information established during onboarding.</p>
        </div>
        <a [routerLink]="userHome" class="inline-flex min-h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">Back to workspace</a>
      } @else {
        <div role="alert" class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{{ loadError() || 'Profile could not be loaded.' }}</div>
        <button type="button" class="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700" (click)="loadProfile()">Try again</button>
      }
    </section>
  `,
})
export class ProfileComponent implements OnInit {
  private readonly service = inject(ProfileService);
  protected readonly auth = inject(AuthService);
  protected readonly profile = signal<UserProfile | null>(null);
  protected readonly loading = signal(true);
  protected readonly avatarBusy = signal(false);
  protected readonly uploadProgress = signal<number | null>(null);
  protected readonly avatarError = signal('');
  protected readonly loadError = signal('');
  private readonly validImageTypes = ['image/png', 'image/jpeg', 'image/webp'];

  ngOnInit(): void { this.loadProfile(); }

  protected get userHome(): string {
    return this.auth.user()?.organization.type === 'DISTRIBUTOR' ? '/distributor/dashboard' : '/manufacturer/dashboard';
  }

  protected initials(): string {
    return (this.profile()?.fullName ?? '').trim().split(/\s+/).slice(0, 2).map(part => part[0] ?? '').join('').toUpperCase() || '?';
  }

  protected loadProfile(): void {
    this.loading.set(true);
    this.loadError.set('');
    this.service.getMe().pipe(finalize(() => this.loading.set(false))).subscribe({
      next: user => this.profile.set(user),
      error: error => { this.loadError.set(this.errorMessage(error, 'Unable to load your profile.')); this.profile.set(null); },
    });
  }

  protected chooseAvatar(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    this.avatarError.set('');
    if (!file) return;
    if (!this.validImageTypes.includes(file.type)) { this.avatarError.set('Choose an image file in PNG, JPEG, or WebP format.'); input.value = ''; return; }
    if (file.size > 5 * 1024 * 1024) { this.avatarError.set('The image must be 5 MB or smaller.'); input.value = ''; return; }
    this.avatarBusy.set(true); this.uploadProgress.set(0);
    this.service.uploadAvatar(file).pipe(finalize(() => { this.avatarBusy.set(false); this.uploadProgress.set(null); input.value = ''; })).subscribe({
      next: state => {
        if (state.profile) {
          this.profile.set(state.profile);
          this.service.setProfile(state.profile);
          this.avatarError.set('');
        } else this.uploadProgress.set(state.progress);
      },
      error: error => this.avatarError.set(this.errorMessage(error, 'Unable to upload your photo.')),
    });
  }

  private errorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      const body = error.error as { message?: unknown; detail?: unknown } | null;
      if (typeof body?.message === 'string') return body.message;
      if (typeof body?.detail === 'string') return body.detail;
    }
    return fallback;
  }
}
