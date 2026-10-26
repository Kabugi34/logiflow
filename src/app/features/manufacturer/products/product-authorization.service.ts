import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { API_ENDPOINTS } from '../../../core/api/api-endpoints';
import { ProductAuthorization } from '../../../core/models/product-authorization.model';

interface Page<T> { content?: T[]; }

@Injectable({ providedIn: 'root' })
export class ProductAuthorizationService {
  private readonly http = inject(HttpClient);
  readonly requests = signal<ProductAuthorization[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');

  refresh(): void {
    this.loading.set(true);
    this.error.set('');
    this.http.get<Page<ProductAuthorization> | ProductAuthorization[]>(API_ENDPOINTS.manufacturer.productAuthorizations)
      .subscribe({
        next: result => {
          this.requests.set(Array.isArray(result) ? result : result.content ?? []);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Distribution requests are not available. Confirm the product authorization API is enabled.');
          this.loading.set(false);
        }
      });
  }

  decide(id: string, decision: 'APPROVED' | 'REJECTED') {
    return this.http.patch(API_ENDPOINTS.manufacturer.productAuthorizationDecision(id), { decision });
  }
}
