import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="mx-auto max-w-3xl space-y-5">
      <header class="border-b border-slate-200 pb-4">
        <p class="text-xs font-medium uppercase tracking-[0.18em] text-blue-600">Account</p>
        <h1 class="mt-1 text-2xl font-semibold text-slate-900">Your profile</h1>
        <p class="mt-1 text-sm text-slate-500">
          Profile information from your authenticated session.
        </p>
      </header>

      @if (auth.user(); as user) {
        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <dl class="grid gap-5 sm:grid-cols-2">
            <div>
              <dt class="text-xs font-medium text-slate-500">Name</dt>
              <dd class="mt-1 break-words text-sm font-medium text-slate-900">
                {{ user.name || 'Unavailable' }}
              </dd>
            </div>
            <div>
              <dt class="text-xs font-medium text-slate-500">Email</dt>
              <dd class="mt-1 break-all text-sm font-medium text-slate-900">
                {{ user.email || 'Unavailable' }}
              </dd>
            </div>
            <div>
              <dt class="text-xs font-medium text-slate-500">Organization</dt>
              <dd class="mt-1 break-words text-sm font-medium text-slate-900">
                {{ user.organization.name || 'Unavailable' }}
              </dd>
            </div>
            <div>
              <dt class="text-xs font-medium text-slate-500">Organization type</dt>
              <dd class="mt-1 text-sm font-medium text-slate-900">
                {{
                  user.organization.type === 'MANUFACTURER'
                    ? 'Manufacturer'
                    : user.organization.type === 'DISTRIBUTOR'
                      ? 'Distributor'
                      : 'Unavailable'
                }}
              </dd>
            </div>
            <div>
              <dt class="text-xs font-medium text-slate-500">Role</dt>
              <dd class="mt-1 text-sm font-medium text-slate-900">
                {{ user.roles[0] || 'Unavailable' }}
              </dd>
            </div>
          </dl>
        </div>
      } @else {
        <p
          role="status"
          class="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        >
          Profile details are unavailable. Sign in again to refresh your session information.
        </p>
      }

      <a
        [routerLink]="userHome"
        class="inline-flex min-h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >Back to workspace</a
      >
    </section>
  `,
})
export class ProfileComponent {
  protected readonly auth = inject(AuthService);

  protected get userHome(): string {
    return this.auth.user()?.organization.type === 'DISTRIBUTOR'
      ? '/distributor/dashboard'
      : '/manufacturer/dashboard';
  }
}
