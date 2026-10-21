import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/api/api-endpoints';
import { DistributorPurchaseOrder, DraftProcurementLine, ProcurementManufacturer, ProcurementOrderLine } from './procurement.models';

interface ApiProduct { id: string; organizationId: string | null; manufacturerOrganizationId?: string | null; sourceStockItemId?: string | null; sku: string; name: string; category: string | null; unitPrice: number; active: boolean; inStock?: boolean; }
interface ApiPo { id: string; purchaseOrderNumber: string; buyerOrganizationId: string; supplierOrganizationId: string; status: string; totalAmount: number; submittedAt: string; items: { stockItemId: string; sku: string; name: string; quantity: number; unitPrice: number }[]; }
interface ApiPage<T> { content?: T[]; }
interface ProcurementProduct { id: string; organizationId: string; sku: string; name: string; description: string; category: string; unitPrice: number; stock: number; unit: string; }

@Injectable({ providedIn: 'root' })
export class DistributorProcurementService {
  private readonly http = inject(HttpClient);
  private readonly productRecords = signal<ProcurementProduct[]>([]);
  private readonly orderRecords = signal<DistributorPurchaseOrder[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly manufacturers = computed<ProcurementManufacturer[]>(() => [...new Set(this.productRecords().map(product => product.organizationId))]
    .map(id => ({ id, name: id, productBrand: '', location: '' })));
  readonly orders = this.orderRecords.asReadonly();
  readonly inTransitOrders = computed(() => this.orderRecords().filter(order => order.status === 'IN_TRANSIT'));

  constructor() { this.refreshProducts(); this.refreshOrders(); }

  refreshProducts(): void {
    this.http.get<ApiPage<ApiProduct> | ApiProduct[]>(`${API_ENDPOINTS.distributor.products}?size=100`).subscribe({
      next: result => {
        const page = Array.isArray(result) ? result : result.content ?? [];
        this.productRecords.set(page.filter(product => product.active && typeof (product.manufacturerOrganizationId ?? product.organizationId) === 'string').map(product => ({
          id: product.sourceStockItemId ?? product.id,
          organizationId: product.manufacturerOrganizationId ?? product.organizationId!,
          sku: product.sku, name: product.name, description: '', category: product.category ?? 'Uncategorized',
          unitPrice: product.unitPrice, stock: product.inStock ? 1 : 0, unit: '\u2014'
        })));
      },
      error: () => this.error.set('Supplier products could not be loaded from the API.')
    });
  }

  refreshOrders(): void {
    this.loading.set(true);
    this.http.get<ApiPage<ApiPo> | ApiPo[]>(API_ENDPOINTS.distributor.purchaseOrders).subscribe({
      next: result => {
        const page = Array.isArray(result) ? result : result.content ?? [];
        this.orderRecords.set(page.map(po => this.toPurchaseOrder(po)));
        this.loading.set(false);
      },
      error: () => { this.error.set('Purchase orders could not be loaded from the API.'); this.loading.set(false); }
    });
  }

  loadOrder(id: string): void {
    this.http.get<ApiPo>(API_ENDPOINTS.distributor.purchaseOrder(id)).subscribe({
      next: row => {
        const order = this.toPurchaseOrder(row);
        this.orderRecords.update(rows => rows.some(existing => existing.id === id)
          ? rows.map(existing => existing.id === id ? order : existing)
          : [order, ...rows]);
      },
      error: error => this.error.set(error?.error?.message ?? 'Purchase order details could not be loaded.')
    });
  }

  loadSettlements(id: string) {
    return this.http.get<{ id: string; status: string; amount: number; currency: string; note: string | null; settledAt: string | null }[]>(API_ENDPOINTS.distributor.purchaseOrderSettlements(id));
  }
  findManufacturer(id: string): ProcurementManufacturer | undefined { return this.manufacturers().find(manufacturer => manufacturer.id === id); }
  manufacturerForBrand(_brand: string): ProcurementManufacturer | undefined { return undefined; }
  indicativeUnitCost(sku: string): number { return this.productRecords().find(product => product.sku === sku)?.unitPrice ?? 0; }
  productsForManufacturer(manufacturerId: string): ProcurementProduct[] { return this.productRecords().filter(product => product.organizationId === manufacturerId); }
  findOrder(id: string): DistributorPurchaseOrder | undefined { return this.orderRecords().find(order => order.id === id); }
  total(order: Pick<DistributorPurchaseOrder, 'lines' | 'logisticsCost'>): number {
    return order.lines.reduce((sum, line) => sum + line.quantity * line.unitCost, 0) + order.logisticsCost;
  }

  createDraft(manufacturerId: string, draftLines: DraftProcurementLine[]): Observable<string> {
    const products = this.productsForManufacturer(manufacturerId);
    if (!this.findManufacturer(manufacturerId)) throw new Error('Select a supplier from the live product catalog.');
    if (!draftLines.length) throw new Error('Add at least one product to the purchase order.');
    const items = draftLines.map(line => {
      const product = products.find(item => item.sku === line.sku);
      if (!product) throw new Error('Each selected product must belong to the selected supplier.');
      if (!Number.isInteger(line.quantity) || line.quantity < 1) throw new Error('Enter a valid quantity for every product.');
      return { stockItemId: product.id, quantity: line.quantity };
    });
    return this.http.post<ApiPo>(API_ENDPOINTS.distributor.purchaseOrders, { supplierOrganizationId: manufacturerId, items })
      .pipe(map(result => { this.refreshOrders(); return result.id; }));
  }

  private toPurchaseOrder(po: ApiPo): DistributorPurchaseOrder {
    const status = po.status === 'APPROVED' ? 'PROCESSING' : po.status === 'FULFILLED' ? 'DELIVERED'
      : po.status === 'REJECTED' ? 'REJECTED' : 'PENDING';
    const lines: ProcurementOrderLine[] = (po.items ?? []).map(item => ({
      sku: item.sku, productName: item.name, quantity: item.quantity, unit: '\u2014', unitCost: item.unitPrice
    }));
    return {
      id: po.id, manufacturerId: po.supplierOrganizationId, manufacturerName: po.supplierOrganizationId,
      manufacturerLocation: '', orderDate: po.submittedAt, expectedDelivery: '', status, destination: '', logisticsCost: 0,
      lines, timeline: [], route: [], currentRouteIndex: 0
    };
  }
}
