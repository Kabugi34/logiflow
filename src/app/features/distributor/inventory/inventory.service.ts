import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { API_CONFIG } from '../../../core/api/api.config';
import { DistributorInventoryItem, StockLevel } from './inventory.models';

interface StockItemResponse {
  id: string; sku: string; name: string; category: string | null; unitPrice: number;
  quantityOnHand: number; reorderThreshold: number; active: boolean;
}
interface ApiPage<T> { content?: T[]; }

@Injectable({ providedIn: 'root' })
export class DistributorInventoryService {
  private readonly http = inject(HttpClient);
  private readonly inventoryRecords = signal<DistributorInventoryItem[]>([]);
  readonly items = this.inventoryRecords.asReadonly();
  readonly loading = signal(false);
  readonly error = signal('');
  readonly thresholdAlerts = computed(() => this.inventoryRecords()
    .filter(item => this.stockLevel(item) !== 'HEALTHY')
    .sort((a, b) => a.onHand / Math.max(a.lowStockThreshold, 1) - b.onHand / Math.max(b.lowStockThreshold, 1)));

  constructor() { this.refresh(); }

  refresh(): void {
    this.loading.set(true);
    this.http.get<ApiPage<StockItemResponse> | StockItemResponse[]>(`${API_CONFIG.apiRoot}/stock/items?size=100`).subscribe({
      next: result => {
        const rows = Array.isArray(result) ? result : result.content ?? [];
        this.inventoryRecords.set(rows.filter(row => row.active).map(row => ({
          sku: row.sku, name: row.name, category: row.category ?? 'Uncategorized', unit: '—', onHand: row.quantityOnHand,
          unitPrice: row.unitPrice, lowStockThreshold: row.reorderThreshold, criticalStockThreshold: Math.floor(row.reorderThreshold / 2)
        })));
        this.error.set(''); this.loading.set(false);
      },
      error: () => { this.error.set('Inventory could not be loaded from the API.'); this.loading.set(false); }
    });
  }

  findBySku(sku: string): DistributorInventoryItem | undefined { return this.inventoryRecords().find(item => item.sku === sku); }
  stockLevel(item: DistributorInventoryItem): StockLevel {
    if (item.onHand <= item.criticalStockThreshold) return 'CRITICAL';
    if (item.onHand <= item.lowStockThreshold) return 'LOW';
    return 'HEALTHY';
  }
}
