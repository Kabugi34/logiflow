import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/api/api-endpoints';
import { InventoryRow, InventoryTerminal, StockIntakeResult, StockMovementRecord, TerminalInventoryRecord } from './inventory.models';
import { ManufacturerProductService } from '../products/product.service';
import { ManufacturerWarehouseService } from '../warehouses/warehouse.service';

interface StockItem { id: string; sku: string; name: string; category: string | null; quantityOnHand: number; reservedQuantity?: number; availableQuantity?: number; reorderThreshold: number; active?: boolean; warehouseId?: string | null; warehouse?: { id: string; name?: string } | null; }
interface ApiPage<T> { content?: T[]; }

@Injectable({ providedIn: 'root' })
export class ManufacturerInventoryService {
  private readonly intakeKeys = new Map<string, string>();
  private readonly productService = inject(ManufacturerProductService);
  readonly warehouseService = inject(ManufacturerWarehouseService);
  readonly terminals: InventoryTerminal[] = [{ id: 'ORG', name: 'Organization stock', city: '' }];
  private readonly activeTerminalId = signal('ORG');
  private readonly records = signal<TerminalInventoryRecord[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly auditRequestSubmitted = signal(false);

  constructor() { this.refresh(); }

  refresh(): void {
    this.loading.set(true);
    this.http.get<ApiPage<StockItem> | StockItem[]>(`${API_ENDPOINTS.manufacturer.stockItems}?size=100`).subscribe({
      next: response => {
        const items = Array.isArray(response) ? response : response.content ?? [];
        this.records.set(items.filter(item => item.active !== false).map(item => ({
          id: item.id,
          stockItemId: item.id,
          warehouseId: item.warehouseId ?? item.warehouse?.id ?? null,
          warehouseName: item.warehouse?.name,
          productName: item.name, sku: item.sku, category: item.category ?? 'Uncategorized', terminalId: 'ORG',
          totalStock: item.quantityOnHand, reservedHolds: item.reservedQuantity ?? 0,
          availableQuantity: item.availableQuantity ?? 0,
        })));
        this.error.set(''); this.loading.set(false);
      },
      error: () => { this.error.set('Inventory could not be loaded from the API.'); this.loading.set(false); }
    });
  }

  getTerminalId(): string { return this.activeTerminalId(); }
  setTerminal(terminalId: string): void { this.activeTerminalId.set(terminalId); }
  getCategories(): string[] { return [...new Set(this.records().map(record => record.category).filter((x): x is string => !!x))]; }
  getRows(category = 'All categories'): InventoryRow[] {
    const unpublishedSkus = new Set(
      this.productService.products()
        .filter(product => product.publicationStatus !== 'PUBLISHED')
        .map(product => product.sku),
    );
    return this.records().filter(record => record.terminalId === this.activeTerminalId())
      .filter(record => !unpublishedSkus.has(record.sku))
      .filter(record => category === 'All categories' || record.category === category)
      .map(record => {
        const availableNet = record.availableQuantity;
        return { ...record, availableNet, alert: availableNet <= 20 ? 'CRITICAL STOCK HOLD' : 'HEALTHY LEVEL' };
      });
  }
  requestAudit(): Observable<unknown> {
    return this.http.post(API_ENDPOINTS.manufacturer.stockAudits, { scope: 'ORGANIZATION', terminalId: this.activeTerminalId() })
      .pipe(tap(() => this.auditRequestSubmitted.set(true)));
  }

  associateWarehouse(stockItemId: string, warehouseId: string): Observable<unknown> {
    if (!stockItemId || !warehouseId) throw new Error('Select a stock item and warehouse.');
    const warehouse = this.warehouseService.findById(warehouseId);
    if (!warehouse || warehouse.status !== 'ACTIVE') throw new Error('Select an active organization warehouse.');
    return this.http.post(API_ENDPOINTS.manufacturer.stockItemWarehouse(stockItemId, warehouseId), null)
      .pipe(tap(() => this.refresh()));
  }

  intake(stockItemId: string, quantity: number, sourceReference: string, note: string): Observable<StockIntakeResult> {
    if (!Number.isSafeInteger(quantity) || quantity < 1) throw new Error('Enter a positive whole-number quantity.');
    if (!sourceReference.trim()) throw new Error('Enter a production lot or source reference.');
    const key = `${stockItemId}:${sourceReference.trim()}:${quantity}`;
    let idempotencyKey = this.intakeKeys.get(key);
    if (!idempotencyKey) {
      idempotencyKey = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      this.intakeKeys.set(key, idempotencyKey);
    }
    return this.http.post<StockIntakeResult>(API_ENDPOINTS.manufacturer.stockItemIntakes(stockItemId), {
      quantity, idempotencyKey, sourceReference: sourceReference.trim(), note: note.trim() || undefined,
    }).pipe(tap(() => { this.intakeKeys.delete(key); this.refresh(); }));
  }

  loadMovements(stockItemId: string): Observable<StockMovementRecord[] | ApiPage<StockMovementRecord>> {
    return this.http.get<ApiPage<StockMovementRecord> | StockMovementRecord[]>(`${API_ENDPOINTS.manufacturer.stockItemMovements(stockItemId)}?size=100`)
      ;
  }
  private readonly http = inject(HttpClient);
}
