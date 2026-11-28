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
import {
  PurchaseOrderSettlement,
  PurchasePaymentTerms,
} from '../../../core/models/purchase-order-settlement.model';
import { Observable, catchError, forkJoin, map, of, tap } from 'rxjs';
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
  settlements?: PurchaseOrderSettlement[];
  totalAmount?: number | null;
  paymentTerms?: PurchasePaymentTerms | null;
  dueAt?: string | null;
  overdue?: boolean | null;
  amountPaid?: number | null;
  amountOutstanding?: number | null;
  rejectionReason?: string | null;
  reviewedAt?: string | null;
  fulfilledAt?: string | null;
  fulfilmentStatus?: string | null;
  fulfillmentStatus?: string | null;
  packageCount?: number;
  items: { id?: string; purchaseOrderItemId?: string; stockItemId?: string; sku: string; name: string; quantity: number; pickedQuantity?: number; packedQuantity?: number; unitPrice: number }[];
}
interface ApiPage<T> {
  content?: T[];
}
interface ApiStock {
  id?: string;
  stockItemId?: string;
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
  private readonly payments = inject(PaymentService);
  private readonly records = signal<ManufacturerPurchaseOrder[]>([]);
  private stockRecords: ApiStock[] = [];
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
      UNKNOWN: rows.filter((row) => row.status === 'UNKNOWN').length,
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
      ).pipe(catchError(() => of([] as ApiStock[]))),
    }).subscribe({
      next: ({ orders, stock }) => {
        const page = Array.isArray(orders) ? orders : (orders.content ?? []);
        const stockRows = Array.isArray(stock) ? stock : (stock.content ?? []);
        this.stockRecords = stockRows;
        const mappedOrders = page.map((row) => this.mapOrder(row, stockRows));
        this.records.set(mappedOrders);
        for (const order of mappedOrders) {
          if (order.status === 'ACCEPTED' || order.status === 'FULFILLED') this.refreshPaymentStatus(order.id);
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

  /**
   * Records a bank payment the supplier has seen arrive. Only a manufacturer
   * administrator is allowed; the server enforces it and the exact-amount rule
   * for pay-now orders.
   */
  confirmBankPayment(id: string, reference: string, amountReceived: number): Observable<void> {
    return this.http
      .post<ApiPo>(API_ENDPOINTS.manufacturer.purchaseOrderConfirmPayment(id), {
        reference,
        amountReceived,
      })
      .pipe(
        tap(() => this.refresh()),
        map(() => undefined),
      );
  }

  /** The proof is fetched with the session's credentials; it is never a public URL. */
  downloadProof(id: string, documentId: string): Observable<Blob> {
    return this.http.get(API_ENDPOINTS.manufacturer.purchaseOrderProof(id, documentId), {
      responseType: 'blob',
    });
  }

  retryFulfilment(id: string): Observable<ApiPo> {
    return this.http.post<ApiPo>(API_ENDPOINTS.manufacturer.purchaseOrderFulfilmentRetry(id), {})
      .pipe(tap(() => { this.refreshPurchaseOrder(id); this.refreshStock(); }));
  }

  pickLine(id: string, purchaseOrderItemId: string, pickedQuantity: number): Observable<ApiPo> {
    if (!Number.isSafeInteger(pickedQuantity) || pickedQuantity < 0) throw new Error('Picked quantity must be a non-negative whole number.');
    return this.http.patch<ApiPo>(API_ENDPOINTS.manufacturer.purchaseOrderPick(id), { purchaseOrderItemId, pickedQuantity })
      .pipe(tap(() => { this.refreshPurchaseOrder(id); this.refreshStock(); }));
  }

  packOrder(id: string, packageCount: number, lines: { purchaseOrderItemId: string; packedQuantity: number }[]): Observable<ApiPo> {
    if (!Number.isSafeInteger(packageCount) || packageCount < 1) throw new Error('Package count must be a positive whole number.');
    if (!lines.length || lines.some(line => !line.purchaseOrderItemId || !Number.isSafeInteger(line.packedQuantity) || line.packedQuantity < 0)) throw new Error('Provide valid packed quantities for every purchase-order line.');
    return this.http.patch<ApiPo>(API_ENDPOINTS.manufacturer.purchaseOrderPack(id), { packageCount, lines })
      .pipe(tap(() => { this.refreshPurchaseOrder(id); this.refreshStock(); }));
  }

  private mapOrder(row: ApiPo, stock: ApiStock[], payment?: ApiPayment): ManufacturerPurchaseOrder {
    const status: PurchaseOrderStatus = ({
      SUBMITTED: 'PENDING',
      PENDING: 'PENDING',
      APPROVED: 'ACCEPTED',
      ACCEPTED: 'ACCEPTED',
      FULFILLED: 'FULFILLED',
      REJECTED: 'REJECTED',
      CANCELLED: 'CANCELLED',
    } as Record<string, PurchaseOrderStatus>)[row.status] ?? 'UNKNOWN';
    const lineTotal = (row.items ?? []).reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    return {
      id: row.id,
      distributorId: row.buyerOrganizationId,
      paymentTerms: 'PAY_NOW',
      totalAmount: row.totalAmount ?? lineTotal,
      amountPaid: row.amountPaid ?? 0,
      amountOutstanding: row.amountOutstanding ?? row.totalAmount ?? lineTotal,
      dueAt: row.dueAt ?? null,
      overdue: row.overdue ?? false,
      settlements: row.settlements ?? [],
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
      destinationHub: row.destinationWarehouseId?.trim() || 'Destination unavailable from purchase-order API',
      destinationWarehouseId: row.destinationWarehouseId?.trim() || undefined,
      issueDate: row.submittedAt,
      status,
      purchaseOrderNumber: row.purchaseOrderNumber,
      fulfilmentStatus: this.mapFulfilmentStatus(row.fulfilmentStatus ?? row.fulfillmentStatus),
      packageCount: row.packageCount,
      paymentStatus: this.mapPaymentStatus(
        row.paymentStatus ?? row.settlements?.[row.settlements.length - 1]?.status ?? payment?.status,
      ),
      lines: (row.items ?? []).map((item) => {
        const lineId = item.purchaseOrderItemId ?? item.id;
        const matching = item.stockItemId
          ? stock.find(stockItem => stockItem.id === item.stockItemId || stockItem.stockItemId === item.stockItemId)
          : stock.find(stockItem => stockItem.sku === item.sku);
        return {
          productName: item.name,
          sku: item.sku,
          requestedQuantity: item.quantity,
          availableStock:
            matching?.availableQuantity ??
            Math.max(0, (matching?.quantityOnHand ?? 0) - (matching?.reservedQuantity ?? 0)),
          purchaseOrderItemId: lineId,
          stockItemId: item.stockItemId,
          pickedQuantity: item.pickedQuantity ?? 0,
          packedQuantity: item.packedQuantity ?? 0,
          unitPrice: item.unitPrice,
          unit: 'Pcs',
        };
      }),
      timeline: [],
    };
  }

  private mapFulfilmentStatus(status: string | null | undefined): ManufacturerPurchaseOrder['fulfilmentStatus'] {
    switch (status?.trim().toUpperCase()) {
      case 'INVENTORY_EXCEPTION': return 'INVENTORY_EXCEPTION';
      case 'READY_FOR_PICKING': return 'READY_FOR_PICKING';
      case 'PICKING': return 'PICKING';
      case 'READY_FOR_DISPATCH': return 'READY_FOR_DISPATCH';
      case 'PICKING_IN_PROGRESS': case 'PACKING': return 'PICKING';
      case 'READY_FOR_SHIPMENT': case 'READY_TO_SHIP': return 'READY_FOR_DISPATCH';
      default: return 'UNKNOWN';
    }
  }

  private refreshStock(): void {
    this.http.get<ApiPage<ApiStock> | ApiStock[]>(`${API_ENDPOINTS.manufacturer.stockItems}?size=100`).subscribe({
      next: response => { this.stockRecords = Array.isArray(response) ? response : response.content ?? []; },
    });
  }

  private refreshPurchaseOrder(id: string): void {
    this.http.get<ApiPo>(API_ENDPOINTS.manufacturer.purchaseOrder(id)).subscribe({
      next: row => {
        const mapped = this.mapOrder(row, this.stockRecords);
        this.records.update(rows => rows.some(order => order.id === id)
          ? rows.map(order => order.id === id ? mapped : order)
          : [mapped, ...rows]);
      },
      error: () => this.refresh(),
    });
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
