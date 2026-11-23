import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { API_ENDPOINTS } from '../../../core/api/api-endpoints';
import { AuthService } from '../../../core/auth/auth.service';
import { normalizePaymentStatus } from '../../../core/models/payment.model';
import {
  ManufacturerPurchaseOrder,
  PurchaseOrderStatus,
  PurchasePaymentStatus,
} from './purchase-order.models';
import { Observable, forkJoin, map, tap } from 'rxjs';
import { PaymentService } from '../../payments/payment.service';

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
  destinationWarehouseId?: string | null;
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
@Injectable({ providedIn: 'root' })
export class ManufacturerPurchaseOrderService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly payments = inject(PaymentService);
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
    if (this.loading()) return;
    this.loading.set(true);
    forkJoin({
      orders: this.http.get<ApiPage<ApiPo> | ApiPo[]>(API_ENDPOINTS.manufacturer.purchaseOrders),
      stock: this.http.get<ApiPage<ApiStock> | ApiStock[]>(
        `${API_ENDPOINTS.manufacturer.stockItems}?size=100`,
      ),
    }).subscribe({
      next: ({ orders, stock }) => {
        const page = Array.isArray(orders) ? orders : (orders.content ?? []);
        const stockRows = Array.isArray(stock) ? stock : (stock.content ?? []);
        const mappedOrders = page.map((row) => this.mapOrder(row, stockRows));
        this.records.set(mappedOrders);
        for (const order of mappedOrders) {
          if (order.status === 'ACCEPTED') this.refreshPaymentStatus(order.id);
        }
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

  private mapOrder(row: ApiPo, stock: ApiStock[]): ManufacturerPurchaseOrder {
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
        (row.buyerOrganizationId ? `Distributor ${row.buyerOrganizationId}` : 'Distributor name unavailable'),
      manufacturerName: this.auth.user()?.organization.name?.trim() || 'Manufacturer',
      destinationHub: row.destinationWarehouseId?.trim() || 'Destination unavailable from purchase-order API',
      destinationWarehouseId: row.destinationWarehouseId?.trim() || undefined,
      issueDate: row.submittedAt,
      status,
      paymentStatus: this.mapPaymentStatus(
        row.paymentStatus,
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

  private refreshPaymentStatus(orderId: string): void {
    this.payments.verifyOrderPayment('PURCHASE_ORDER', orderId).subscribe({
      next: (verification) => {
        if (!verification.paymentExists) return;
        this.records.update((rows) =>
          rows.map((order) => order.id === orderId
          ? {
              ...order,
              paymentStatus: verification.status,
              paymentDetails: verification.status === 'PAID' && verification.transaction
                ? {
                    amount: verification.transaction.amount,
                    currency: verification.transaction.currency,
                    reference: verification.transaction.mpesaReceiptNumber || verification.transaction.paymentReference,
                    mode: verification.transaction.provider,
                    reconciledAt: verification.transaction.reconciledAt,
                  }
                : undefined,
            }
            : order),
        );
      },
      error: () => undefined,
    });
  }
}
