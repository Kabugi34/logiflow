import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { API_ENDPOINTS } from '../../../core/api/api-endpoints';
import { DistributorCatalogOffer, DistributorCatalogProduct } from './catalog.models';

interface ApiPage<T> { content?: T[]; }
interface ApiProduct { id: string; organizationId: string | null; sourceStockItemId?: string | null; manufacturerOrganizationId?: string | null; sku: string; name: string; category: string | null; unitPrice: number; active: boolean; inStock?: boolean; }
interface ApiStockItem { id: string; sourceStockItemId: string | null; manufacturerOrganizationId: string | null; warehouseId: string | null; sku: string; name: string; category: string | null; unitPrice: number; reorderThreshold: number; active: boolean; }
interface ApiWarehouse { id: string; code: string; name: string; address: string; active: boolean; }

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

  constructor() { this.refresh(); }

  refresh(): void {
    this.loading.set(true);
    this.http.get<ApiPage<ApiProduct> | ApiProduct[]>(`${API_ENDPOINTS.distributor.products}?size=100`).subscribe({
      next: result => {
        const rows = Array.isArray(result) ? result : result.content ?? [];
        this.productRecords.set(rows.filter(row => row.active && !row.sourceStockItemId && typeof row.organizationId === 'string').map(row => ({
          id: row.id, manufacturerId: row.organizationId!, sku: row.sku, name: row.name,
          manufacturerName: row.manufacturerOrganizationId ?? row.organizationId!, category: row.category ?? 'Uncategorized',
          brand: '', unit: '\u2014', stock: row.inStock ?? false, description: ''
        })));
      },
      error: () => this.error.set('Manufacturer products could not be loaded.')
    });
    this.http.get<ApiPage<ApiStockItem> | ApiStockItem[]>(`${API_ENDPOINTS.distributor.stockItems}?size=100`).subscribe({
      next: result => {
        const rows = Array.isArray(result) ? result : result.content ?? [];
        this.offerRecords.set(rows.filter(row => !!row.sourceStockItemId).map(row => ({
          id: row.id, manufacturerId: row.manufacturerOrganizationId ?? '', manufacturerName: row.manufacturerOrganizationId ?? 'Manufacturer',
          sku: row.sku, productName: row.name, category: row.category ?? 'Uncategorized', brand: '', unit: '\u2014',
          listPrice: row.unitPrice, reorderThreshold: row.reorderThreshold, status: row.active ? 'ACTIVE' : 'PAUSED',
          addedAt: '', notes: ''
        })));
        this.loading.set(false);
      },
      error: () => { this.error.set('Your catalog offers could not be loaded.'); this.loading.set(false); }
    });
    this.http.get<ApiPage<ApiWarehouse> | ApiWarehouse[]>(`${API_ENDPOINTS.distributor.warehouses}?size=100`).subscribe({
      next: result => this.warehouseRecords.set((Array.isArray(result) ? result : result.content ?? []).filter(row => row.active)),
      error: () => this.error.set('Warehouses could not be loaded. Create or select an active warehouse before publishing an offer.')
    });
  }

  createWarehouse(request: { code: string; name: string; address: string }) {
    return this.http.post<ApiWarehouse>(API_ENDPOINTS.distributor.warehouses, request);
  }
  addOffer(draft: { sourceStockItemId: string; warehouseId: string; sku: string; listPrice: number; reorderThreshold: number }) {
    return this.http.post<ApiStockItem>(API_ENDPOINTS.distributor.stockOffers, {
      sourceStockItemId: draft.sourceStockItemId, warehouseId: draft.warehouseId,
      sku: draft.sku, sellingPrice: draft.listPrice, reorderThreshold: draft.reorderThreshold
    });
  }

  updateOffer(id: string, update: { sellingPrice?: number; reorderThreshold?: number; active?: boolean }) {
    return this.http.patch<ApiStockItem>(API_ENDPOINTS.distributor.stockOffer(id), update);
  }
}
