import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { API_ENDPOINTS } from '../../../core/api/api-endpoints';
import { ProductAuthorization } from '../../../core/models/product-authorization.model';

interface Page<T> { content?: T[]; }
interface ApiAuthorization extends Partial<ProductAuthorization> {
  manufacturerProductId?: string;
  createdAt?: string;
}

function distributorNameFromNote(note: string | null | undefined): string {
  return note?.match(/^Distributor organization:\s*(.+)$/m)?.[1]?.trim() ?? '';
}

@Injectable({ providedIn: 'root' })
export class ProductAuthorizationService {
  private readonly http = inject(HttpClient);
  readonly requests = signal<ProductAuthorization[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');

  refresh(): void {
    this.loading.set(true);
    this.error.set('');
    this.http.get<Page<ApiAuthorization> | ApiAuthorization[]>(API_ENDPOINTS.manufacturer.incomingProductAuthorizations)
      .subscribe({
        next: result => {
          const rows = Array.isArray(result) ? result : result.content ?? [];
          this.requests.set(rows.map(row => ({
            ...row,
            productId: row.manufacturerProductId ?? row.productId ?? '',
            requestedAt: row.createdAt ?? row.requestedAt ?? '',
            productName: row.productName ?? '',
            sku: row.sku ?? '',
            manufacturerOrganizationId: row.manufacturerOrganizationId ?? '',
            manufacturerName: row.manufacturerName ?? '',
            distributorOrganizationId: row.distributorOrganizationId ?? '',
            distributorName: row.distributorName || distributorNameFromNote(row.requestNote),
            decidedAt: row.decidedAt ?? null,
          } as ProductAuthorization)));
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Distribution requests are not available. Confirm the product authorization API is enabled.');
          this.loading.set(false);
        }
      });
  }

  decide(id: string, status: 'APPROVED' | 'REJECTED', note: string) {
    return this.http.patch(API_ENDPOINTS.manufacturer.productAuthorizationDecision(id), { status, note });
  }
}
