import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/api/api-endpoints';
import { normalizePaymentStatus } from '../../../core/models/payment.model';
import {
  PurchaseOrderSettlement,
  PurchasePaymentTerms,
} from '../../../core/models/purchase-order-settlement.model';
import { PaymentService } from '../../payments/payment.service';
import { DistributorCatalogService } from '../catalog/catalog.service';
import {
  DistributorPurchaseOrder,
  DraftProcurementLine,
  ProcurementManufacturer,
  ProcurementOrderLine,
} from './procurement.models';

interface ApiProduct {
  id: string;
  organizationId: string | null;
  manufacturerOrganizationId?: string | null;
  manufacturerName?: string | null;
  sourceStockItemId?: string | null;
  publicationStatus?: string | null;
  sku: string;
  name: string;
  description?: string | null;
  category: string | null;
  unitPrice: number;
  unit?: string | null;
  active: boolean;
  inStock?: boolean | null;
  availableQuantity?: number | null;
}
interface ApiPo {
  id: string;
  purchaseOrderNumber: string;
  buyerOrganizationId: string;
  supplierOrganizationId: string;
  supplierOrganizationName?: string | null;
  manufacturerName?: string | null;
  status: string;
  paymentStatus?: string | null;
  paymentTerms?: PurchasePaymentTerms | null;
  dueAt?: string | null;
  overdue?: boolean | null;
  amountPaid?: number | null;
  amountOutstanding?: number | null;
  totalAmount: number;
  submittedAt: string;
  items: {
    stockItemId: string;
    sku: string;
    name: string;
    quantity: number;
    unitPrice: number;
    shippedQuantity?: number | null;
  }[];
}
interface ApiPage<T> {
  content?: T[];
}
interface ProcurementProduct {
  id: string;
  productId: string;
  organizationId: string;
  manufacturerName: string;
  sku: string;
  name: string;
  description: string;
  category: string;
  unitPrice: number;
  inStock: boolean | null;
  unit: string;
  availableQuantity: number | null;
}

@Injectable({ providedIn: 'root' })
export class DistributorProcurementService {
  private readonly http = inject(HttpClient);
  private readonly catalog = inject(DistributorCatalogService);
  private readonly payments = inject(PaymentService);
  private readonly productRecords = signal<ProcurementProduct[]>([]);
  private readonly orderRecords = signal<DistributorPurchaseOrder[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly manufacturers = computed<ProcurementManufacturer[]>(() =>
    [
      ...new Set(
        this.productRecords()
          .map((product) => product.organizationId),
      ),
    ].map((id) => ({
      id,
      name:
        this.productRecords().find((product) => product.organizationId === id)?.manufacturerName ??
        'Manufacturer',
      productBrand: '',
      location: '',
    })),
  );
  readonly orders = this.orderRecords.asReadonly();

  constructor() {
    this.refreshProducts();
    this.refreshOrders();
  }

  refreshProducts(): void {
    this.http
      .get<ApiPage<ApiProduct> | ApiProduct[]>(`${API_ENDPOINTS.distributor.products}?size=100`)
      .subscribe({
        next: (result) => {
          const page = Array.isArray(result) ? result : (result.content ?? []);
          this.productRecords.set(
            page
              .filter(
                (product) =>
                  product.active &&
                  product.publicationStatus === 'PUBLISHED' &&
                  typeof (product.manufacturerOrganizationId ?? product.organizationId) ===
                    'string',
              )
              .map((product) => ({
                id: product.sourceStockItemId ?? product.id,
                productId: product.id,
                organizationId: product.manufacturerOrganizationId ?? product.organizationId!,
                manufacturerName: product.manufacturerName?.trim() || 'Manufacturer',
                sku: product.sku,
                name: product.name,
                description: product.description?.trim() ?? '',
                category: product.category ?? 'Uncategorized',
                unitPrice: product.unitPrice,
                inStock: product.inStock ?? null,
                availableQuantity:
                  typeof product.availableQuantity === 'number' &&
                  Number.isInteger(product.availableQuantity) &&
                  product.availableQuantity >= 0
                    ? product.availableQuantity
                    : null,
                unit: product.unit?.trim() || '\u2014',
              })),
          );
          // Orders can load before products; resolve their supplier labels again once
          // the product directory (which carries manufacturer names) is available.
          this.orderRecords.update((orders) =>
            orders.map((order) => ({
              ...order,
              manufacturerName: this.supplierName(order.manufacturerId),
            })),
          );
        },
        error: () => this.error.set('Supplier products could not be loaded from the API.'),
      });
  }

  refreshOrders(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.http.get<ApiPage<ApiPo> | ApiPo[]>(API_ENDPOINTS.distributor.purchaseOrders).subscribe({
      next: (result) => {
        const page = Array.isArray(result) ? result : (result.content ?? []);
        const orders = page.map((po) => this.toPurchaseOrder(po));
        this.orderRecords.set(orders);
        for (const order of orders) this.refreshPaymentStatus(order.id);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Purchase orders could not be loaded from the API.');
        this.loading.set(false);
      },
    });
  }

  loadOrder(id: string): void {
    this.http.get<ApiPo>(API_ENDPOINTS.distributor.purchaseOrder(id)).subscribe({
      next: (row) => {
        const order = this.toPurchaseOrder(row);
        this.orderRecords.update((rows) =>
          rows.some((existing) => existing.id === id)
            ? rows.map((existing) => (existing.id === id ? order : existing))
            : [order, ...rows],
        );
        this.refreshPaymentStatus(order.id);
      },
      error: (error) =>
        this.error.set(error?.error?.message ?? 'Purchase order details could not be loaded.'),
    });
  }

  loadSettlements(id: string) {
    return this.http.get<PurchaseOrderSettlement[]>(
      API_ENDPOINTS.distributor.purchaseOrderSettlements(id),
    );
  }

  /**
   * Submits the bank reference and proof. This does not settle the order: it stays
   * unpaid until the supplier's administrator confirms the amount received. The
   * idempotency key must be reused when the same submission is retried.
   */
  submitBankTransfer(
    orderId: string,
    reference: string,
    proof: File,
    idempotencyKey: string,
  ): Observable<void> {
    const body = new FormData();
    body.append('reference', reference.trim());
    body.append('file', proof, proof.name);
    return this.http
      .post<ApiPo>(API_ENDPOINTS.distributor.purchaseOrderBankTransfer(orderId), body, {
        headers: { 'Idempotency-Key': idempotencyKey },
      })
      .pipe(
        map((row) => {
          const order = this.toPurchaseOrder(row);
          this.orderRecords.update((rows) =>
            rows.map((existing) => (existing.id === orderId ? order : existing)),
          );
        }),
      );
  }
  findManufacturer(id: string): ProcurementManufacturer | undefined {
    return this.manufacturers().find((manufacturer) => manufacturer.id === id);
  }
  manufacturerForBrand(_brand: string): ProcurementManufacturer | undefined {
    return undefined;
  }
  indicativeUnitCost(sku: string): number {
    return this.productRecords().find((product) => product.sku === sku)?.unitPrice ?? 0;
  }
  productsForManufacturer(manufacturerId: string): ProcurementProduct[] {
    return this.productRecords().filter(
      (product) =>
        product.organizationId === manufacturerId &&
        this.catalog.authorizationStatus(product.productId) === 'APPROVED',
    );
  }
  checkoutProducts(): ProcurementProduct[] {
    // Centralized wholesale checkout is purchase based. Authorization requests
    // remain available as a separate legacy distribution workflow.
    return this.productRecords();
  }
  findOrder(id: string): DistributorPurchaseOrder | undefined {
    return this.orderRecords().find((order) => order.id === id);
  }
  total(order: Pick<DistributorPurchaseOrder, 'lines' | 'logisticsCost'>): number {
    return (
      order.lines.reduce((sum, line) => sum + line.quantity * line.unitCost, 0) +
      order.logisticsCost
    );
  }

  initiatePayment(orderId: string, phoneNumber: string) {
    return this.payments.initiate({
      orderId,
      orderType: 'PURCHASE_ORDER',
      provider: 'MPESA',
      phoneNumber,
    });
  }

  recordPaymentStatus(orderId: string, status: string): void {
    const paymentStatus = normalizePaymentStatus(status);
    this.orderRecords.update((rows) =>
      rows.map((order) => (order.id === orderId ? { ...order, paymentStatus } : order)),
    );
  }

  private refreshPaymentStatus(orderId: string): void {
    this.payments.verifyOrderPayment('PURCHASE_ORDER', orderId).subscribe({
      next: (verification) => {
        if (verification.paymentExists) this.recordPaymentStatus(orderId, verification.status);
      },
      error: () => undefined,
    });
  }

  createDraft(
    manufacturerId: string,
    draftLines: DraftProcurementLine[],
    paymentTerms: PurchasePaymentTerms = 'PAY_NOW',
  ): Observable<string> {
    const products = this.productRecords().filter(
      (product) => product.organizationId === manufacturerId,
    );
    if (!products.length) throw new Error('Select a supplier from the live product catalog.');
    if (!draftLines.length) throw new Error('Add at least one product to the purchase order.');
    const items = draftLines.map((line) => {
      const product = products.find((item) => item.sku === line.sku);
      if (!product) throw new Error('Each selected product must belong to the selected supplier.');
      if (this.catalog.authorizationStatus(product.productId) !== 'APPROVED') {
        throw new Error('Manufacturer authorization is required before purchasing this product.');
      }
      if (!Number.isInteger(line.quantity) || line.quantity < 1)
        throw new Error('Enter a valid quantity for every product.');
      return { stockItemId: product.id, quantity: line.quantity };
    });
    return this.http
      .post<ApiPo>(API_ENDPOINTS.distributor.purchaseOrders, {
        supplierOrganizationId: manufacturerId,
        items,
        paymentTerms,
      })
      .pipe(
        map((result) => {
          this.refreshOrders();
          return result.id;
        }),
      );
  }

  private toPurchaseOrder(po: ApiPo): DistributorPurchaseOrder {
    const status = ['SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'FULFILLED'].includes(po.status)
      ? po.status as DistributorPurchaseOrder['status']
      : 'UNKNOWN';
    const lines: ProcurementOrderLine[] = (po.items ?? []).map((item) => ({
      sku: item.sku,
      productName: item.name,
      quantity: item.quantity,
      unit: '\u2014',
      unitCost: item.unitPrice,
      shippedQuantity: item.shippedQuantity ?? undefined,
    }));
    return {
      id: po.id,
      manufacturerId: po.supplierOrganizationId,
      manufacturerName:
        po.supplierOrganizationName?.trim() ||
        po.manufacturerName?.trim() ||
        this.supplierName(po.supplierOrganizationId),
      manufacturerLocation: '',
      orderDate: po.submittedAt,
      expectedDelivery: '',
      status,
      paymentStatus: normalizePaymentStatus(po.paymentStatus),
      paymentTerms: po.paymentTerms === 'CREDIT' ? 'CREDIT' : 'PAY_NOW',
      dueAt: po.dueAt ?? null,
      overdue: po.overdue ?? false,
      amountPaid: po.amountPaid ?? 0,
      amountOutstanding: po.amountOutstanding ?? po.totalAmount,
      destination: '',
      logisticsCost: 0,
      lines,
      timeline: [],
      route: [],
      currentRouteIndex: 0,
    };
  }

  private supplierName(organizationId: string): string {
    const productName = this.productRecords().find(
      (product) => product.organizationId === organizationId && product.manufacturerName.trim(),
    )?.manufacturerName.trim();
    if (productName && productName !== 'Manufacturer') return productName;
    const catalogName = this.catalog.manufacturers().find(
      (manufacturer) => manufacturer.id === organizationId && manufacturer.name.trim(),
    )?.name.trim();
    return catalogName && catalogName !== 'Manufacturer' ? catalogName : 'Supplier';
  }
}
