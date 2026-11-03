import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { API_ENDPOINTS } from '../../../core/api/api-endpoints';
import { DistributorCatalogOffer, DistributorCatalogProduct } from './catalog.models';
import { ProductAuthorization } from '../../../core/models/product-authorization.model';

interface ApiPage<T> {
  content?: T[];
}
function catalogAuthorizationStatus(
  status: ProductAuthorization['status'] | undefined,
): DistributorCatalogProduct['authorizationStatus'] {
  return status === 'PENDING' || status === 'APPROVED' || status === 'REJECTED' ? status : 'NONE';
}
interface ApiProduct {
  id: string;
  organizationId: string | null;
  sourceStockItemId?: string | null;
  manufacturerOrganizationId?: string | null;
  manufacturerName?: string | null;
  sku: string;
  name: string;
  category: string | null;
  brand?: string | null;
  unit?: string | null;
  description?: string | null;
  unitPrice: number;
  availableQuantity?: number | null;
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
  availableQuantity?: number | null;
  manufacturerName?: string | null;
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
  code: string;
  name: string;
  address: string;
  city: string;
  postalCode: string;
  siteManager: string;
}

export interface ProductAuthorizationRequest {
  requestNote: string;
}

@Injectable({ providedIn: 'root' })
export class DistributorCatalogService {
  private readonly http = inject(HttpClient);
  private readonly offerRecords = signal<DistributorCatalogOffer[]>([]);
  private readonly productRecords = signal<DistributorCatalogProduct[]>([]);
  private readonly warehouseRecords = signal<ApiWarehouse[]>([]);
  readonly offers = computed(() =>
    this.offerRecords().map((offer) => {
      const product = this.productRecords().find(
        (item) =>
          item.manufacturerId === offer.manufacturerId &&
          (item.id === offer.sourceStockItemId || item.sku === offer.sku),
      );
      return {
        ...offer,
        productName: product?.name ?? offer.productName,
        manufacturerName: product?.manufacturerName ?? offer.manufacturerName,
        category: product?.category ?? offer.category,
        brand: product?.brand ?? offer.brand,
        unit: product?.unit ?? offer.unit,
        description: product?.description ?? offer.description,
        imageUrl: product?.imageUrl ?? offer.imageUrl,
        wholesalePrice: product?.wholesalePrice ?? offer.wholesalePrice,
      };
    }),
  );
  readonly availableProducts = this.productRecords.asReadonly();
  readonly allWarehouses = this.warehouseRecords.asReadonly();
  readonly warehouses = computed(() =>
    this.warehouseRecords().filter((warehouse) => warehouse.active),
  );
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
    const done = () => {
      loaded++;
      if (loaded === 4) this.loading.set(false);
    };
    this.http
      .get<ApiPage<ApiProduct> | ApiProduct[]>(`${API_ENDPOINTS.distributor.products}?size=100`)
      .subscribe({
        next: (result) => {
          const rows = Array.isArray(result) ? result : (result.content ?? []);
          this.productRecords.set(
            rows
              .filter(
                (row) =>
                  row.publicationStatus === 'PUBLISHED' &&
                  !row.sourceStockItemId &&
                  typeof (row.manufacturerOrganizationId ?? row.organizationId) === 'string',
              )
              .map((row) => ({
                id: row.id,
                manufacturerId: row.manufacturerOrganizationId ?? row.organizationId!,
                sku: row.sku,
                name: row.name,
                manufacturerName: row.manufacturerName?.trim() || 'Manufacturer',
                category: row.category ?? 'Uncategorized',
                brand: row.brand ?? '',
                unit: row.unit ?? '\u2014',
                wholesalePrice: Number.isFinite(row.unitPrice) ? row.unitPrice : null,
                availableQuantity:
                  typeof row.availableQuantity === 'number' &&
                  Number.isFinite(row.availableQuantity) &&
                  row.availableQuantity >= 0
                    ? row.availableQuantity
                    : null,
                inStock: row.inStock ?? null,
                description: row.description ?? '',
                imageUrl: row.imageUrl ?? '',
                authorizationStatus: catalogAuthorizationStatus(
                  this.authorizationRecords().find((a) => a.productId === row.id)?.status,
                ),
              })),
          );
          done();
        },
        error: () => {
          this.error.set('Manufacturer products could not be loaded.');
          done();
        },
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
                sourceStockItemId: row.sourceStockItemId ?? row.id,
                manufacturerId: row.manufacturerOrganizationId ?? '',
                manufacturerName: row.manufacturerName?.trim() || 'Manufacturer',
                sku: row.sku,
                productName: row.name,
                category: row.category ?? 'Uncategorized',
                brand: '',
                unit: '\u2014',
                description: '',
                imageUrl: '',
                wholesalePrice: null,
                availableQuantity:
                  typeof row.availableQuantity === 'number' && row.availableQuantity >= 0
                    ? row.availableQuantity
                    : null,
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
          this.warehouseRecords.set(Array.isArray(result) ? result : (result.content ?? []));
          done();
        },
        error: () => {
          this.error.set(
            'Warehouses could not be loaded. Create or select an active warehouse before publishing an offer.',
          );
          done();
        },
      });
    this.http
      .get<{ content?: ProductAuthorization[] } | ProductAuthorization[]>(
        API_ENDPOINTS.distributor.productAuthorizations,
      )
      .subscribe({
        next: (result) => {
          const rows = Array.isArray(result) ? result : (result.content ?? []);
          this.authorizationRecords.set(rows);
          this.productRecords.update((products) =>
            products.map((product) => ({
              ...product,
              authorizationStatus: catalogAuthorizationStatus(
                rows.find((a) => a.productId === product.id)?.status,
              ),
            })),
          );
          done();
        },
        error: () => {
          this.error.set('Authorization status could not be loaded.');
          done();
        },
      });
  }

  createWarehouse(request: WarehouseCreateRequest) {
    return this.http.post<ApiWarehouse>(API_ENDPOINTS.distributor.warehouses, request);
  }

  updateWarehouseStatus(id: string, status: 'ACTIVE' | 'INACTIVE') {
    return this.http.patch<ApiWarehouse>(API_ENDPOINTS.distributor.warehouse(id), { status });
  }
  authorizationStatus(productId: string): ProductAuthorization['status'] | 'NONE' {
    return (
      this.authorizationRecords().find((request) => request.productId === productId)?.status ??
      'NONE'
    );
  }
  addOffer(draft: {
    sourceStockItemId: string;
    warehouseId: string;
    sku: string;
    listPrice: number;
    reorderThreshold: number;
  }) {
    const product = this.productRecords().find(
      (row) => row.id === draft.sourceStockItemId || row.sku === draft.sku,
    );
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

  requestAuthorization(productId: string, request: ProductAuthorizationRequest) {
    return this.http.post<ProductAuthorization>(
      API_ENDPOINTS.distributor.productAuthorizationRequest(productId),
      request,
    );
  }

  updateOffer(
    id: string,
    update: { sellingPrice?: number; reorderThreshold?: number; active?: boolean },
  ) {
    return this.http.patch<ApiStockItem>(API_ENDPOINTS.distributor.stockOffer(id), update);
  }
}
