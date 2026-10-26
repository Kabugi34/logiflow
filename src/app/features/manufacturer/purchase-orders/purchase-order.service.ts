import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { API_ENDPOINTS } from '../../../core/api/api-endpoints';
import { ManufacturerPurchaseOrder, PurchaseOrderStatus } from './purchase-order.models';
import { Observable, forkJoin, map, tap } from 'rxjs';

interface ApiPo {
  id: string; purchaseOrderNumber: string; buyerOrganizationId: string; status: string; submittedAt: string;
  rejectionReason?: string | null; reviewedAt?: string | null; fulfilledAt?: string | null;
  items: { sku: string; name: string; quantity: number; unitPrice: number }[];
}
interface ApiPage<T> { content?: T[]; }
interface ApiStock { sku: string; quantityOnHand: number; reservedQuantity?: number; availableQuantity?: number; }

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
    forkJoin({
      orders: this.http.get<ApiPage<ApiPo> | ApiPo[]>(API_ENDPOINTS.manufacturer.purchaseOrders),
      stock: this.http.get<ApiPage<ApiStock> | ApiStock[]>(`${API_ENDPOINTS.manufacturer.stockItems}?size=100`)
    }).subscribe({
      next: ({ orders, stock }) => {
        const page = Array.isArray(orders) ? orders : orders.content ?? [];
        const stockRows = Array.isArray(stock) ? stock : stock.content ?? [];
        this.records.set(page.map(row => this.mapOrder(row, stockRows)));
        this.error.set('');
        this.loading.set(false);
      },
      error: () => { this.error.set('Purchase orders could not be loaded from the API.'); this.loading.set(false); }
    });
  }

  findById(id: string): ManufacturerPurchaseOrder | undefined { return this.records().find(order => order.id === id); }

  updateStatus(id: string, status: PurchaseOrderStatus, note = ''): Observable<void> {
    const apiStatus = status === 'ACCEPTED' ? 'APPROVED' : status === 'PENDING' ? 'SUBMITTED' : status;
    return this.http
      .patch<ApiPo>(API_ENDPOINTS.manufacturer.purchaseOrderDecision(id), { status: apiStatus, note })
      .pipe(
        tap(() => this.refresh()),
        map(() => undefined),
      );
  }

  private mapOrder(row: ApiPo, stock: ApiStock[]): ManufacturerPurchaseOrder {
    const status: PurchaseOrderStatus = row.status === 'APPROVED' ? 'ACCEPTED'
      : row.status === 'FULFILLED' ? 'FULFILLED'
      : row.status === 'REJECTED' ? 'REJECTED' : 'PENDING';
    return {
      id: row.id,
      distributorName: row.buyerOrganizationId,
      destinationHub: '\u2014',
      issueDate: row.submittedAt,
      status,
      lines: (row.items ?? []).map(item => {
        const matching = stock.find(stockItem => stockItem.sku === item.sku);
        return { productName: item.name, sku: item.sku, requestedQuantity: item.quantity,
          availableStock: matching?.availableQuantity ?? Math.max(0, (matching?.quantityOnHand ?? 0) - (matching?.reservedQuantity ?? 0)),
          unitPrice: item.unitPrice, unit: 'Pcs' };
      }),
      timeline: []
    };
  }
}
