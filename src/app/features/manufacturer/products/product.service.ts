import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { EMPTY, finalize, forkJoin } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { API_ENDPOINTS } from '../../../core/api/api-endpoints';
import { ManufacturerProduct, ProductPublicationStatus } from './product.models';

interface ApiPage<T> {
  content?: T[];
}
interface ApiProduct {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  brand?: string | null;
  unit?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  image?: string | null;
  unitPrice?: number | null;
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
export type ManufacturerProductUpdate = Pick<
  ManufacturerProductDraft,
  'name' | 'category' | 'sku' | 'brand' | 'unit' | 'description' | 'unitPrice'
>;

function rows<T>(response: ApiPage<T> | T[]): T[] {
  return Array.isArray(response) ? response : (response.content ?? []);
}

@Injectable({ providedIn: 'root' })
export class ManufacturerProductService {
  private readonly http = inject(HttpClient);
  private readonly productRecords = signal<ManufacturerProduct[]>([]);
  readonly products = this.productRecords.asReadonly();
  readonly loading = signal(false);
  readonly error = signal('');

  constructor() {
    this.refresh();
  }

  refresh(): void {
    this.loading.set(true);
    this.error.set('');
    forkJoin({
      products: this.http.get<ApiPage<ApiProduct> | ApiProduct[]>(
        `${API_ENDPOINTS.manufacturer.products}?size=100`,
      ),
      stock: this.http.get<ApiPage<StockItemResponse> | StockItemResponse[]>(
        `${API_ENDPOINTS.manufacturer.stockItems}?size=100`,
      ),
    })
      .pipe(
        catchError(() => {
          this.error.set('Products could not be loaded from the API.');
          return EMPTY;
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe(({ products, stock }) => {
        const stockByProduct = new Map<string, StockItemResponse[]>();
        for (const item of rows(stock)) {
          const key = item.productId ?? item.sku;
          stockByProduct.set(key, [...(stockByProduct.get(key) ?? []), item]);
        }
        this.productRecords.set(
          rows(products).map((product) =>
            this.toProduct(
              product,
              stockByProduct.get(product.id) ?? stockByProduct.get(product.sku) ?? [],
            ),
          ),
        );
      });
  }

  findBySku(sku: string): ManufacturerProduct | undefined {
    return this.productRecords().find((product) => product.sku === sku);
  }

  create(product: ManufacturerProductDraft, image: File) {
    return this.http.post<ApiProduct>(
      API_ENDPOINTS.manufacturer.products,
      this.toFormData(product, image),
    );
  }

  update(id: string, product: ManufacturerProductUpdate, image?: File) {
    return this.http.patch<ApiProduct>(
      API_ENDPOINTS.manufacturer.product(id),
      this.toFormData(product, image),
    );
  }

  setPublicationStatus(id: string, status: ProductPublicationStatus) {
    return this.http.patch<ApiProduct>(API_ENDPOINTS.manufacturer.productPublication(id), {
      status,
    });
  }

  private toProduct(product: ApiProduct, stock: StockItemResponse[]): ManufacturerProduct {
    const quantity = stock.reduce((total, item) => total + item.quantityOnHand, 0);
    const threshold = stock.reduce((total, item) => total + item.reorderThreshold, 0);
    const reserved = stock.reduce((total, item) => total + (item.reservedQuantity ?? 0), 0);
    const available = stock.reduce(
      (total, item) =>
        total +
        (item.availableQuantity ??
          Math.max(0, item.quantityOnHand - (item.reservedQuantity ?? 0))),
      0,
    );
    const status =
      quantity <= threshold
        ? 'CRITICAL STOCK'
        : quantity <= threshold * 1.5
          ? 'LOW STOCK'
          : 'ACTIVE';
    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      brand: product.brand ?? '',
      category: product.category ?? 'Uncategorized',
      unit: product.unit ?? '—',
      unitPrice: product.unitPrice ?? stock[0]?.unitPrice ?? null,
      stock: quantity,
      reorderThreshold: threshold,
      status,
      publicationStatus: product.publicationStatus,
      image: this.resolveImageUrl(product.imageUrl ?? product.image ?? ''),
      description: product.description ?? '',
      inventory: stock.length
        ? [
            {
              terminal: 'Organization stock',
              reserved,
              available,
            },
          ]
        : [],
      movements: [],
    };
  }

  private toFormData(
    product: ManufacturerProductDraft | ManufacturerProductUpdate,
    image?: File,
  ): FormData {
    const data = new FormData();
    for (const [key, value] of Object.entries(product)) data.append(key, String(value));
    if (image) data.append('image', image, image.name);
    return data;
  }

  private resolveImageUrl(imageUrl: string): string {
    if (!imageUrl || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(imageUrl)) return imageUrl;
    return new URL(imageUrl, new URL(API_ENDPOINTS.manufacturer.products).origin).toString();
  }
}
