import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { API_ENDPOINTS } from '../../../core/api/api-endpoints';
import { ManufacturerProduct, ProductPublicationStatus } from './product.models';

interface ApiPage<T> { content?: T[]; }
interface ApiProduct {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  brand?: string | null;
  unit?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  publicationStatus: ProductPublicationStatus;
}
interface StockItemResponse {
  id: string;
  productId?: string | null;
  sku: string;
  name: string;
  category: string | null;
  unitPrice: number;
  quantityOnHand: number;
  reservedQuantity?: number;
  availableQuantity?: number;
  reorderThreshold: number;
  active: boolean;
}
export interface ManufacturerProductDraft {
  name: string;
  category: string;
  sku: string;
  brand: string;
  unit: string;
  description: string;
  unitPrice: number;
  initialQuantity: number;
  reorderThreshold: number;
  publicationStatus?: ProductPublicationStatus;
}

function rows<T>(response: ApiPage<T> | T[]): T[] {
  return Array.isArray(response) ? response : response.content ?? [];
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
    this.error.set('');
    forkJoin({
      products: this.http.get<ApiPage<ApiProduct> | ApiProduct[]>(`${API_ENDPOINTS.manufacturer.products}?size=100`),
      stock: this.http.get<ApiPage<StockItemResponse> | StockItemResponse[]>(`${API_ENDPOINTS.manufacturer.stockItems}?size=100`),
    }).pipe(catchError(() => {
      this.error.set('Products could not be loaded from the API.');
      return of({ products: [] as ApiProduct[], stock: [] as StockItemResponse[] });
    })).subscribe(({ products, stock }) => {
      const stockByProduct = new Map<string, StockItemResponse>();
      for (const item of rows(stock)) stockByProduct.set(item.productId ?? item.sku, item);
      this.productRecords.set(rows(products).map(product => this.toProduct(product, stockByProduct.get(product.id) ?? stockByProduct.get(product.sku))));
      this.loading.set(false);
    });
  }

  findBySku(sku: string): ManufacturerProduct | undefined {
    return this.productRecords().find(product => product.sku === sku);
  }

  create(product: ManufacturerProductDraft, image: File) {
    return this.http.post<ApiProduct>(API_ENDPOINTS.manufacturer.products, this.toFormData(product, image));
  }

  update(id: string, product: ManufacturerProductDraft, image?: File) {
    return this.http.patch<ApiProduct>(API_ENDPOINTS.manufacturer.product(id), this.toFormData(product, image));
  }

  setPublicationStatus(id: string, status: ProductPublicationStatus) {
    return this.http.patch<ApiProduct>(API_ENDPOINTS.manufacturer.productPublication(id), { status });
  }

  private toProduct(product: ApiProduct, stock?: StockItemResponse): ManufacturerProduct {
    const quantity = stock?.quantityOnHand ?? 0;
    const threshold = stock?.reorderThreshold ?? 0;
    const status = quantity <= threshold ? 'CRITICAL STOCK'
      : quantity <= threshold * 1.5 ? 'LOW STOCK' : 'ACTIVE';
    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      brand: product.brand ?? '',
      category: product.category ?? 'Uncategorized',
      unit: product.unit ?? '—',
      stock: quantity,
      status,
      publicationStatus: product.publicationStatus,
      image: product.imageUrl ?? '',
      description: product.description ?? '',
      inventory: stock ? [{ terminal: 'Organization stock', reserved: stock.reservedQuantity ?? 0, available: stock.availableQuantity ?? Math.max(0, quantity - (stock.reservedQuantity ?? 0)) }] : [],
      movements: [],
    };
  }

  private toFormData(product: ManufacturerProductDraft, image?: File): FormData {
    const data = new FormData();
    for (const [key, value] of Object.entries(product)) data.append(key, String(value));
    if (image) data.append('image', image, image.name);
    if (product.publicationStatus) data.set('publicationStatus', product.publicationStatus);
    return data;
  }
}
