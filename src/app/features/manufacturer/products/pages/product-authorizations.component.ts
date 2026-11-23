import { Component, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { ProductAuthorizationService } from '../product-authorization.service';
import { ManufacturerProductService } from '../product.service';

@Component({
  standalone: true,
  imports: [RouterLink, DatePipe, CurrencyPipe],
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
        @for (request of service.requests(); track request.id) { <tr><td class="px-4 py-3 font-medium">{{ requestedProductName(request) }} <span class="text-slate-400">· {{ request.sku }}</span></td><td class="px-3 py-3">{{ request.distributorName || 'Distributor name unavailable' }}</td><td class="px-3 py-3">{{ request.requestedAt | date:'mediumDate' }}</td><td class="px-3 py-3">{{ request.status }}</td><td class="px-3 py-3"><button type="button" (click)="openRequest(request.id)" class="font-medium text-blue-700">View details</button> @if (request.status === 'PENDING' && isAdmin) { <button (click)="decide(request.id, 'APPROVED')" [disabled]="!!pendingId()" class="ml-3 font-medium text-emerald-700 disabled:opacity-50">Approve</button><button (click)="decide(request.id, 'REJECTED')" [disabled]="!!pendingId()" class="ml-3 font-medium text-red-700 disabled:opacity-50">Reject</button> }</td></tr> }
        @empty { <tr><td colspan="5" class="px-4 py-10 text-center text-slate-500">No distribution requests.</td></tr> }
      </tbody></table></div> }
    </section>
    @if (requestDetails(); as request) { <div class="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"><section role="dialog" aria-modal="true" aria-labelledby="request-detail-title" class="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-5 shadow-xl"><div class="flex items-start justify-between gap-3"><div><h2 id="request-detail-title" class="text-base font-semibold text-slate-900">Distribution request details</h2><p class="mt-1 text-xs text-slate-500">Submitted {{ request.requestedAt | date:'medium' }} · {{ request.status }}</p></div><button type="button" (click)="selectedRequest.set(null)" class="rounded border border-slate-200 px-3 py-1.5 text-xs">Close</button></div><dl class="mt-4 grid gap-3 sm:grid-cols-2"><div><dt class="text-[10px] uppercase text-slate-400">Distributor organization</dt><dd class="mt-1 text-sm font-medium text-slate-800">{{ request.distributorName || 'Distributor name unavailable' }}</dd></div><div><dt class="text-[10px] uppercase text-slate-400">Product requested</dt><dd class="mt-1 text-sm font-medium text-slate-800">{{ requestedProductName(request) }} <span class="text-slate-500">· {{ request.sku || 'SKU unavailable' }}</span></dd><p class="mt-1 text-[10px] text-slate-500">Product ID: {{ request.productId }}</p></div><div><dt class="text-[10px] uppercase text-slate-400">Contact person, email and phone</dt><dd class="mt-1 text-xs text-slate-600">Not returned by the authorization API.</dd></div><div><dt class="text-[10px] uppercase text-slate-400">Target market</dt><dd class="mt-1 whitespace-pre-wrap text-xs text-slate-700">{{ request.targetMarket || 'Not provided' }}</dd></div><div><dt class="text-[10px] uppercase text-slate-400">Sales channels</dt><dd class="mt-1 whitespace-pre-wrap text-xs text-slate-700">{{ request.salesChannels || 'Not provided' }}</dd></div><div><dt class="text-[10px] uppercase text-slate-400">Geographical coverage</dt><dd class="mt-1 whitespace-pre-wrap text-xs text-slate-700">{{ request.geographicalCoverage || 'Not provided' }}</dd></div><div class="sm:col-span-2"><dt class="text-[10px] uppercase text-slate-400">Distribution strategy</dt><dd class="mt-1 whitespace-pre-wrap text-xs text-slate-700">{{ request.distributionStrategy || 'Not provided' }}</dd></div><div class="sm:col-span-2"><dt class="text-[10px] uppercase text-slate-400">Proposal / request note</dt><dd class="mt-1 whitespace-pre-wrap text-xs text-slate-700">{{ request.requestNote || 'Not provided' }}</dd></div><div><dt class="text-[10px] uppercase text-slate-400">Agreed wholesale price</dt><dd class="mt-1 text-xs text-slate-700">{{ request.agreedWholesalePrice === null || request.agreedWholesalePrice === undefined ? 'Not provided' : (request.agreedWholesalePrice | currency:'KES') }}</dd></div><div><dt class="text-[10px] uppercase text-slate-400">Minimum order quantity</dt><dd class="mt-1 text-xs text-slate-700">{{ request.minimumOrderQuantity ?? 'Not provided' }}</dd></div></dl></section></div> }
    `
})
export class ProductAuthorizationsComponent {
  protected readonly service = inject(ProductAuthorizationService);
  private readonly products = inject(ManufacturerProductService);
  private readonly auth = inject(AuthService);
  protected readonly isAdmin = this.auth.hasRole('MANUFACTURER_ADMIN');
  protected readonly pendingId = signal('');
  protected readonly errorMessage = signal('');
  protected readonly selectedRequest = signal<string | null>(null);
  protected readonly requestDetails = () => this.service.requests().find(row => row.id === this.selectedRequest());
  protected requestedProductName(request: { productId: string; productName: string; sku: string }): string {
    if (request.productName.trim()) return request.productName;
    const product = this.products.products().find(row => String(row.id) === String(request.productId) || row.sku === request.sku);
    return product?.name ?? request.sku ?? `Product ${request.productId}`;
  }
  constructor() { this.service.refresh(); }
  protected openRequest(id: string): void { this.selectedRequest.set(id); }
  protected decide(id: string, status: 'APPROVED' | 'REJECTED'): void {
    if (!this.isAdmin || this.pendingId()) return;
    const note = status === 'REJECTED' ? globalThis.prompt('Provide a reason for rejecting this request:')?.trim() : '';
    if (status === 'REJECTED' && !note) return;
    this.pendingId.set(id); this.errorMessage.set('');
    this.service.decide(id, status, note ?? '').pipe(finalize(() => this.pendingId.set(''))).subscribe({
      next: () => this.service.refresh(),
      error: (error) => this.errorMessage.set(error?.error?.message ?? 'Request decision could not be saved.')
    });
  }
}
