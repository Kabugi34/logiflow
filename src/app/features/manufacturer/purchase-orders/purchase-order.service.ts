import { HttpClient, HttpParams } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { API_ENDPOINTS } from '../../../core/api/api-endpoints';
import { AuthService } from '../../../core/auth/auth.service';
import { normalizePaymentStatus } from '../../../core/models/payment.model';
import {
  ManufacturerPurchaseOrder,
  PurchaseOrderStatus,
  PurchasePaymentStatus,
} from './purchase-order.models';
import { Observable, catchError, forkJoin, map, of, tap } from 'rxjs';

interface ApiPo {
  id: string;
  purchaseOrderNumber: string;
  buyerOrganizationId: string;
  buyerOrganizationName?: string | null;
  distributorOrganizationName?: string | null;
  distributorName?: string | null;
  buyer?: { organizationName?: string | null; name?: string | null } | null;
  buyerOrganization?: { name?: string | null } | null;
  customerOrganizationName?: string | null;
  organizationName?: string | null;
  status: string;
  submittedAt: string;
  paymentStatus?: string | null;
  settlements?: { status: string }[];
  rejectionReason?: string | null;
  reviewedAt?: string | null;
  fulfilledAt?: string | null;
  items: { sku: string; name: string; quantity: number; unitPrice: number }[];
}
interface ApiPage<T> {
  content?: T[];
}
interface ApiStock {
  sku: string;
  quantityOnHand: number;
  reservedQuantity?: number;
  availableQuantity?: number;
}
interface ApiPayment {
  orderId: string;
  counterpartyName?: string | null;
  status: string;
  createdAt?: string;
}

@Injectable({ providedIn: 'root' })
export class ManufacturerPurchaseOrderService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly records = signal<ManufacturerPurchaseOrder[]>([]);
  readonly orders = this.records.asReadonly();
  readonly loading = signal(false);
  readonly error = signal('');
  readonly counts = computed(() => {
    const rows = this.records();
    return {
      PENDING: rows.filter((row) => row.status === 'PENDING').length,
      ACCEPTED: rows.filter((row) => row.status === 'ACCEPTED').length,
      REJECTED: rows.filter((row) => row.status === 'REJECTED').length,
      CANCELLED: rows.filter((row) => row.status === 'CANCELLED').length,
      FULFILLED: rows.filter((row) => row.status === 'FULFILLED').length,
    } satisfies Record<PurchaseOrderStatus, number>;
  });

  constructor() {
    this.refresh();
  }

  refresh(): void {
    this.loading.set(true);
    forkJoin({
      orders: this.http.get<ApiPage<ApiPo> | ApiPo[]>(API_ENDPOINTS.manufacturer.purchaseOrders),
      stock: this.http.get<ApiPage<ApiStock> | ApiStock[]>(
        `${API_ENDPOINTS.manufacturer.stockItems}?size=100`,
      ),
      payments: this.http
        .get<ApiPage<ApiPayment> | ApiPayment[]>(API_ENDPOINTS.payments.transactions, {
          params: new HttpParams().set('orderType', 'PURCHASE_ORDER'),
        })
        .pipe(catchError(() => of([] as ApiPayment[]))),
    }).subscribe({
      next: ({ orders, stock, payments }) => {
        const page = Array.isArray(orders) ? orders : (orders.content ?? []);
        const stockRows = Array.isArray(stock) ? stock : (stock.content ?? []);
        const paymentRows = Array.isArray(payments) ? payments : (payments.content ?? []);
        const paymentByOrder = new Map<string, ApiPayment>();
        for (const payment of paymentRows) {
          const existing = paymentByOrder.get(payment.orderId);
          if (!existing || Date.parse(payment.createdAt ?? '') >= Date.parse(existing.createdAt ?? '')) {
            paymentByOrder.set(payment.orderId, payment);
          }
        }
        this.records.set(page.map((row) => this.mapOrder(row, stockRows, paymentByOrder.get(row.id))));
        this.error.set('');
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Purchase orders could not be loaded from the API.');
        this.loading.set(false);
      },
    });
  }

  findById(id: string): ManufacturerPurchaseOrder | undefined {
    return this.records().find((order) => order.id === id);
  }

  updateStatus(id: string, status: PurchaseOrderStatus, note = ''): Observable<void> {
    const apiStatus =
      status === 'ACCEPTED' ? 'APPROVED' : status === 'PENDING' ? 'SUBMITTED' : status;
    return this.http
      .patch<ApiPo>(API_ENDPOINTS.manufacturer.purchaseOrderDecision(id), {
        status: apiStatus,
        note,
      })
      .pipe(
        tap(() => this.refresh()),
        map(() => undefined),
      );
  }

  private mapOrder(row: ApiPo, stock: ApiStock[], payment?: ApiPayment): ManufacturerPurchaseOrder {
    const status: PurchaseOrderStatus =
      row.status === 'APPROVED'
        ? 'ACCEPTED'
        : row.status === 'FULFILLED'
          ? 'FULFILLED'
          : row.status === 'REJECTED'
            ? 'REJECTED'
            : row.status === 'CANCELLED'
              ? 'CANCELLED'
            : 'PENDING';
    return {
      id: row.id,
      distributorName:
        row.buyerOrganizationName?.trim() ||
        row.distributorOrganizationName?.trim() ||
        row.distributorName?.trim() ||
        row.buyer?.organizationName?.trim() ||
        row.buyer?.name?.trim() ||
        row.buyerOrganization?.name?.trim() ||
        row.customerOrganizationName?.trim() ||
        row.organizationName?.trim() ||
        payment?.counterpartyName?.trim() ||
        (row.buyerOrganizationId ? `Distributor ${row.buyerOrganizationId}` : 'Distributor name unavailable'),
      manufacturerName: this.auth.user()?.organization.name?.trim() || 'Manufacturer',
      destinationHub: '\u2014',
      issueDate: row.submittedAt,
      status,
      paymentStatus: this.mapPaymentStatus(
        row.paymentStatus ?? row.settlements?.[row.settlements.length - 1]?.status ?? payment?.status,
      ),
      lines: (row.items ?? []).map((item) => {
        const matching = stock.find((stockItem) => stockItem.sku === item.sku);
        return {
          productName: item.name,
          sku: item.sku,
          requestedQuantity: item.quantity,
          availableStock:
            matching?.availableQuantity ??
            Math.max(0, (matching?.quantityOnHand ?? 0) - (matching?.reservedQuantity ?? 0)),
          unitPrice: item.unitPrice,
          unit: 'Pcs',
        };
      }),
      timeline: [],
    };
  }

  private mapPaymentStatus(status: string | null | undefined): PurchasePaymentStatus {
    return normalizePaymentStatus(status);
  }
}
