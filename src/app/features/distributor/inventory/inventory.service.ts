import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { API_ENDPOINTS } from '../../../core/api/api-endpoints';
import { DistributorInventoryItem, StockLevel } from './inventory.models';

interface StockItemResponse { id: string; manufacturerOrganizationId: string | null; sku: string; name: string; category: string | null; unitPrice: number; quantityOnHand: number; reorderThreshold: number; active: boolean; }
interface RestockRequestResponse { id: string; stockItemId: string; requestedQuantity: number; status: string; createdAt: string; }
interface ApiPage<T> { content?: T[]; }

@Injectable({ providedIn: 'root' })
export class DistributorInventoryService {
  private readonly http = inject(HttpClient);
  private readonly inventoryRecords = signal<DistributorInventoryItem[]>([]);
  private readonly requestRecords = signal<RestockRequestResponse[]>([]);
  readonly items = this.inventoryRecords.asReadonly();
  readonly restockRequests = this.requestRecords.asReadonly();
  readonly loading = signal(false);
  readonly error = signal('');
  readonly thresholdAlerts = computed(() => this.inventoryRecords()
    .filter(item => this.stockLevel(item) !== 'HEALTHY')
    .sort((a, b) => a.onHand / Math.max(a.lowStockThreshold, 1) - b.onHand / Math.max(b.lowStockThreshold, 1)));

  constructor() { this.refresh(); this.refreshRestockRequests(); }

  refresh(): void {
    this.loading.set(true);
    this.http.get<ApiPage<StockItemResponse> | StockItemResponse[]>(`${API_ENDPOINTS.distributor.stockItems}?size=100`).subscribe({
      next: result => {
        const rows = Array.isArray(result) ? result : result.content ?? [];
        this.inventoryRecords.set(rows.filter(row => row.active).map(row => ({
          id: row.id, manufacturerOrganizationId: row.manufacturerOrganizationId, sku: row.sku, name: row.name,
          category: row.category ?? 'Uncategorized', unit: '\u2014', onHand: row.quantityOnHand, unitPrice: row.unitPrice,
          lowStockThreshold: row.reorderThreshold, criticalStockThreshold: Math.floor(row.reorderThreshold / 2)
        })));
        this.error.set(''); this.loading.set(false);
      },
      error: () => { this.error.set('Inventory could not be loaded from the API.'); this.loading.set(false); }
    });
  }

  refreshRestockRequests(): void {
    this.http.get<ApiPage<RestockRequestResponse> | RestockRequestResponse[]>(`${API_ENDPOINTS.distributor.restockRequests}?size=100`).subscribe({
      next: result => this.requestRecords.set(Array.isArray(result) ? result : result.content ?? []),
      error: () => this.error.set('Restock requests could not be loaded from the API.')
    });
  }

  findBySku(sku: string): DistributorInventoryItem | undefined { return this.inventoryRecords().find(item => item.sku === sku); }
  hasPendingRestock(itemId: string): boolean { return !!this.pendingRestockId(itemId); }
  pendingRestockId(itemId: string): string | undefined { return this.requestRecords().find(request => request.stockItemId === itemId && request.status === 'PENDING')?.id; }
  requestRestock(item: DistributorInventoryItem, quantity: number, note = '') {
    if (!item.manufacturerOrganizationId) throw new Error('This item is not a distributor offer linked to a manufacturer product.');
    return this.http.post<RestockRequestResponse>(API_ENDPOINTS.distributor.restockRequests, {
      stockItemId: item.id, manufacturerOrganizationId: item.manufacturerOrganizationId, requestedQuantity: quantity, note
    });
  }
  cancelRestockRequest(id: string) {
    return this.http.patch<RestockRequestResponse>(API_ENDPOINTS.distributor.restockRequestStatus(id), { status: 'CANCELLED' });
  }
  stockLevel(item: DistributorInventoryItem): StockLevel {
    if (item.onHand <= item.criticalStockThreshold) return 'CRITICAL';
    if (item.onHand <= item.lowStockThreshold) return 'LOW';
    return 'HEALTHY';
  }
}
