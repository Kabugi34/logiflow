import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { API_ENDPOINTS } from '../../../core/api/api-endpoints';
import { DistributorCatalogOffer, DistributorCatalogProduct } from './catalog.models';
import { ProductAuthorization } from '../../../core/models/product-authorization.model';

interface ApiPage<T> {
  content?: T[];
}
function catalogAuthorizationStatus(status: ProductAuthorization['status'] | undefined): DistributorCatalogProduct['authorizationStatus'] {
  return status === 'PENDING' || status === 'APPROVED' || status === 'REJECTED' ? status : 'NONE';
}
interface ApiProduct {
  id: string;
  organizationId: string | null;
  sourceStockItemId?: string | null;
  manufacturerOrganizationId?: string | null;
  sku: string;
  name: string;
  category: string | null;
  unitPrice: number;
  active: boolean;
  inStock?: boolean;
  publicationStatus?: string;
  imageUrl?: string | null;
}
interface ApiStockItem {
  id: string;
  sourceStockItemId: string | null;
  manufacturerOrganizationId: string | null;
  warehouseId: string | null;
  sku: string;
  name: string;
  category: string | null;
  unitPrice: number;
  reorderThreshold: number;
  active: boolean;
}
interface ApiWarehouse {
  id: string;
  code: string;
  name: string;
  address: string;
  city?: string | null;
  postalCode?: string | null;
  siteManager?: string | null;
  active: boolean;
}

export interface WarehouseCreateRequest {
  code: string; name: string; address: string; city: string; postalCode: string; siteManager: string;
}

@Injectable({ providedIn: 'root' })
export class DistributorCatalogService {
  private readonly http = inject(HttpClient);
  private readonly offerRecords = signal<DistributorCatalogOffer[]>([]);
  private readonly productRecords = signal<DistributorCatalogProduct[]>([]);
  private readonly warehouseRecords = signal<ApiWarehouse[]>([]);
  readonly offers = this.offerRecords.asReadonly();
  readonly availableProducts = this.productRecords.asReadonly();
  readonly warehouses = this.warehouseRecords.asReadonly();
  readonly loading = signal(false);
  readonly error = signal('');
  private readonly authorizationRecords = signal<ProductAuthorization[]>([]);
  readonly authorizations = this.authorizationRecords.asReadonly();

  constructor() {
    this.refresh();
  }

  refresh(): void {
    this.loading.set(true);
    this.error.set('');
    let loaded = 0;
    const done = () => { loaded++; if (loaded === 4) this.loading.set(false); };
    this.http
      .get<ApiPage<ApiProduct> | ApiProduct[]>(`${API_ENDPOINTS.distributor.products}?size=100`)
      .subscribe({
        next: (result) => {
          const rows = Array.isArray(result) ? result : (result.content ?? []);
          this.productRecords.set(
            rows
              .filter((row) => row.publicationStatus === 'PUBLISHED' && !row.sourceStockItemId && typeof row.organizationId === 'string')
              .map((row) => ({
                id: row.id,
                manufacturerId: row.organizationId!,
                sku: row.sku,
                name: row.name,
                manufacturerName: row.manufacturerOrganizationId ?? row.organizationId!,
                category: row.category ?? 'Uncategorized',
                brand: '',
                unit: '\u2014',
                stock: row.inStock ?? false,
                description: '',
                imageUrl: row.imageUrl ?? '',
                authorizationStatus: catalogAuthorizationStatus(this.authorizationRecords().find(a => a.productId === row.id)?.status),
              })),
          );
          done();
        },
        error: () => { this.error.set('Manufacturer products could not be loaded.'); done(); },
      });
    this.http
      .get<ApiPage<ApiStockItem> | ApiStockItem[]>(
        `${API_ENDPOINTS.distributor.stockItems}?size=100`,
      )
      .subscribe({
        next: (result) => {
          const rows = Array.isArray(result) ? result : (result.content ?? []);
          this.offerRecords.set(
            rows
              .filter((row) => !!row.sourceStockItemId)
              .map((row) => ({
                id: row.id,
                manufacturerId: row.manufacturerOrganizationId ?? '',
                manufacturerName: row.manufacturerOrganizationId ?? 'Manufacturer',
                sku: row.sku,
                productName: row.name,
                category: row.category ?? 'Uncategorized',
                brand: '',
                unit: '\u2014',
                listPrice: row.unitPrice,
                reorderThreshold: row.reorderThreshold,
                status: row.active ? 'ACTIVE' : 'PAUSED',
                addedAt: '',
                notes: '',
              })),
          );
          done();
        },
        error: () => {
          this.error.set('Your catalog offers could not be loaded.');
          done();
        },
      });
    this.http
      .get<ApiPage<ApiWarehouse> | ApiWarehouse[]>(
        `${API_ENDPOINTS.distributor.warehouses}?size=100`,
      )
      .subscribe({
        next: (result) => {
          this.warehouseRecords.set((Array.isArray(result) ? result : (result.content ?? [])).filter((row) => row.active));
          done();
        },
        error: () => {
          this.error.set('Warehouses could not be loaded. Create or select an active warehouse before publishing an offer.');
          done();
        },
      });
    this.http.get<{ content?: ProductAuthorization[] } | ProductAuthorization[]>(API_ENDPOINTS.distributor.productAuthorizations).subscribe({
      next: result => {
        const rows = Array.isArray(result) ? result : result.content ?? [];
        this.authorizationRecords.set(rows);
        this.productRecords.update(products => products.map(product => ({
          ...product,
          authorizationStatus: catalogAuthorizationStatus(rows.find(a => a.productId === product.id)?.status)
        })));
        done();
      },
      error: () => { this.error.set('Authorization status could not be loaded.'); done(); }
    });
  }

  createWarehouse(request: WarehouseCreateRequest) {
    return this.http.post<ApiWarehouse>(API_ENDPOINTS.distributor.warehouses, request);
  }
  addOffer(draft: {
    sourceStockItemId: string;
    warehouseId: string;
    sku: string;
    listPrice: number;
    reorderThreshold: number;
  }) {
    const product = this.productRecords().find(row => row.id === draft.sourceStockItemId || row.sku === draft.sku);
    if (!product || product.authorizationStatus !== 'APPROVED') {
      throw new Error('Manufacturer authorization is required before listing this product.');
    }
    return this.http.post<ApiStockItem>(API_ENDPOINTS.distributor.stockOffers, {
      sourceStockItemId: draft.sourceStockItemId,
      warehouseId: draft.warehouseId,
      sku: draft.sku,
      sellingPrice: draft.listPrice,
      reorderThreshold: draft.reorderThreshold,
    });
  }

  requestAuthorization(productId: string) {
    return this.http.post<ProductAuthorization>(API_ENDPOINTS.distributor.productAuthorizationRequest(productId), {});
  }

  updateOffer(
    id: string,
    update: { sellingPrice?: number; reorderThreshold?: number; active?: boolean },
  ) {
    return this.http.patch<ApiStockItem>(API_ENDPOINTS.distributor.stockOffer(id), update);
  }
}
