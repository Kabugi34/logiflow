import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { API_CONFIG } from '../../../core/api/api.config';
import { ManufacturerPurchaseOrder, PurchaseOrderStatus } from './purchase-order.models';

interface ApiPo {
  id: string; purchaseOrderNumber: string; buyerOrganizationId: string; status: string; submittedAt: string;
  items: { sku: string; name: string; quantity: number; unitPrice: number }[];
}
interface ApiPage<T> { content?: T[]; }

@Injectable({ providedIn: 'root' })
export class ManufacturerPurchaseOrderService {
  private readonly http = inject(HttpClient);
  private readonly records = signal<ManufacturerPurchaseOrder[]>([]);
  readonly orders = this.records.asReadonly();
  readonly loading = signal(false);
  readonly error = signal('');
  readonly counts = computed(() => {
    const rows = this.records();
    return {
      PENDING: rows.filter(row => row.status === 'PENDING').length,
      ACCEPTED: rows.filter(row => row.status === 'ACCEPTED').length,
      REJECTED: rows.filter(row => row.status === 'REJECTED').length,
      FULFILLED: rows.filter(row => row.status === 'FULFILLED').length
    } satisfies Record<PurchaseOrderStatus, number>;
  });

  constructor() { this.refresh(); }

  refresh(): void {
    this.loading.set(true);
    this.http.get<ApiPage<ApiPo>>(`${API_CONFIG.baseUrl}/manufacturer/purchase-orders`).subscribe({
      next: page => { this.records.set((page.content ?? []).map(row => this.mapOrder(row))); this.error.set(''); this.loading.set(false); },
      error: () => { this.error.set('Purchase orders could not be loaded from the API.'); this.loading.set(false); }
    });
  }

  findById(id: string): ManufacturerPurchaseOrder | undefined { return this.records().find(order => order.id === id); }

  updateStatus(id: string, status: PurchaseOrderStatus, note = '') {
    const apiStatus = status === 'ACCEPTED' ? 'APPROVED' : status === 'PENDING' ? 'SUBMITTED' : status;
    this.http.patch<ApiPo>(`${API_CONFIG.baseUrl}/manufacturer/purchase-orders/${encodeURIComponent(id)}/decision`, { status: apiStatus, note }).subscribe({
      next: () => this.refresh(),
      error: () => this.error.set('The purchase order decision could not be saved.')
    });
  }

  private mapOrder(row: ApiPo): ManufacturerPurchaseOrder {
    const status: PurchaseOrderStatus = row.status === 'APPROVED' ? 'ACCEPTED'
      : row.status === 'FULFILLED' ? 'FULFILLED'
      : row.status === 'REJECTED' ? 'REJECTED' : 'PENDING';
    return {
      id: row.id,
      distributorName: row.buyerOrganizationId,
      destinationHub: '—',
      issueDate: row.submittedAt,
      status,
      lines: (row.items ?? []).map(item => ({ productName: item.name, sku: item.sku, requestedQuantity: item.quantity, availableStock: 0, unitPrice: item.unitPrice, unit: 'Pcs' })),
      timeline: []
    };
  }
}
