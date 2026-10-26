import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { ProductAuthorizationService } from '../product-authorization.service';

@Component({
  standalone: true,
  imports: [RouterLink, DatePipe],
  template: `
    <section class="space-y-5">
      <header class="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-4">
        <div><a routerLink="/manufacturer/products" class="text-xs text-blue-600">Products</a><h1 class="mt-2 text-xl font-semibold text-slate-900">Distribution requests</h1><p class="mt-1 text-sm text-slate-500">Review distributor requests to list your published products.</p></div>
        <button type="button" (click)="service.refresh()" class="rounded-md border border-slate-200 px-3 py-2 text-xs">Refresh</button>
      </header>
      @if (!isAdmin) { <p class="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Manufacturer administrator access is required to review requests.</p> }
      @if (errorMessage()) { <p role="alert" class="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{{ errorMessage() }}</p> }
      @if (service.error()) { <p role="alert" class="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{{ service.error() }} <button type="button" (click)="service.refresh()" class="underline">Retry</button></p> }
      @if (service.loading()) { <p role="status" class="p-8 text-center text-sm text-slate-500">Loading distribution requests…</p> }
      @else { <div class="overflow-x-auto rounded-lg border border-slate-200 bg-white"><table class="w-full min-w-[640px] text-left text-xs"><thead class="bg-slate-50 text-slate-600"><tr><th class="px-4 py-3">Product</th><th class="px-3 py-3">Distributor</th><th class="px-3 py-3">Requested</th><th class="px-3 py-3">Status</th><th class="px-3 py-3">Decision</th></tr></thead><tbody class="divide-y divide-slate-100">
        @for (request of service.requests(); track request.id) { <tr><td class="px-4 py-3 font-medium">{{ request.productName }} <span class="text-slate-400">· {{ request.sku }}</span></td><td class="px-3 py-3">{{ request.distributorName }}</td><td class="px-3 py-3">{{ request.requestedAt | date:'mediumDate' }}</td><td class="px-3 py-3">{{ request.status }}</td><td class="px-3 py-3">@if (request.status === 'PENDING' && isAdmin) { <button (click)="decide(request.id, 'APPROVED')" [disabled]="!!pendingId()" class="font-medium text-emerald-700 disabled:opacity-50">Approve</button><button (click)="decide(request.id, 'REJECTED')" [disabled]="!!pendingId()" class="ml-3 font-medium text-red-700 disabled:opacity-50">Reject</button> } @else { <span class="text-slate-400">—</span> }</td></tr> }
        @empty { <tr><td colspan="5" class="px-4 py-10 text-center text-slate-500">No distribution requests.</td></tr> }
      </tbody></table></div> }
    </section>`
})
export class ProductAuthorizationsComponent {
  protected readonly service = inject(ProductAuthorizationService);
  private readonly auth = inject(AuthService);
  protected readonly isAdmin = this.auth.hasRole('MANUFACTURER_ADMIN');
  protected readonly pendingId = signal('');
  protected readonly errorMessage = signal('');
  constructor() { this.service.refresh(); }
  protected decide(id: string, decision: 'APPROVED' | 'REJECTED'): void {
    if (!this.isAdmin || this.pendingId()) return;
    this.pendingId.set(id); this.errorMessage.set('');
    this.service.decide(id, decision).pipe(finalize(() => this.pendingId.set(''))).subscribe({
      next: () => this.service.refresh(),
      error: (error) => this.errorMessage.set(error?.error?.message ?? 'Request decision could not be saved.')
    });
  }
}
