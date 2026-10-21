import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { API_CONFIG } from '../../../core/api/api.config';
import { ManufacturerProduct } from './product.models';

interface StockItemResponse {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  unitPrice: number;
  quantityOnHand: number;
  reorderThreshold: number;
  active: boolean;
}
interface ApiPage<T> { content?: T[]; }

interface CreateStockItemRequest {
  sku: string;
  name: string;
  category: string;
  unitPrice: number;
  initialQuantity: number;
  reorderThreshold: number;
}

@Injectable({ providedIn: 'root' })
export class ManufacturerProductService {
  private readonly http = inject(HttpClient);
  private readonly productRecords = signal<ManufacturerProduct[]>([]);
  readonly products = this.productRecords.asReadonly();
  readonly loading = signal(false);
  readonly error = signal('');

  constructor() { this.refresh(); }

  refresh(): void {
    this.loading.set(true);
    this.http.get<ApiPage<StockItemResponse> | StockItemResponse[]>(`${API_CONFIG.apiRoot}/stock/items?size=100`).subscribe({
      next: result => {
        const items = Array.isArray(result) ? result : result.content ?? [];
        this.productRecords.set(items.map(item => this.toProduct(item)));
        this.error.set('');
        this.loading.set(false);
      },
      error: () => { this.error.set('Products could not be loaded from the API.'); this.loading.set(false); }
    });
  }

  findBySku(sku: string): ManufacturerProduct | undefined {
    return this.productRecords().find(product => product.sku === sku);
  }

  save(product: CreateStockItemRequest) {
    return this.http.post<StockItemResponse>(`${API_CONFIG.apiRoot}/stock/items`, product);
  }

  private toProduct(item: StockItemResponse): ManufacturerProduct {
    const status = item.quantityOnHand <= item.reorderThreshold ? 'CRITICAL STOCK'
      : item.quantityOnHand <= item.reorderThreshold * 1.5 ? 'LOW STOCK' : 'ACTIVE';
    return {
      id: item.id, name: item.name, sku: item.sku, brand: '—', category: item.category ?? 'Uncategorized',
      unit: '—', stock: item.quantityOnHand, status, image: '', description: '', inventory: [], movements: []
    };
  }
}
