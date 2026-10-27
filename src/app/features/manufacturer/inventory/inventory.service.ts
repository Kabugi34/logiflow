import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/api/api-endpoints';
import { InventoryRow, InventoryTerminal, TerminalInventoryRecord } from './inventory.models';

interface StockItem { sku: string; name: string; category: string | null; quantityOnHand: number; reservedQuantity?: number; availableQuantity?: number; reorderThreshold: number; }
interface ApiPage<T> { content?: T[]; }

@Injectable({ providedIn: 'root' })
export class ManufacturerInventoryService {
  readonly terminals: InventoryTerminal[] = [{ id: 'ORG', name: 'Organization stock', city: '' }];
  private readonly activeTerminalId = signal('ORG');
  private readonly records = signal<TerminalInventoryRecord[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly auditRequestSubmitted = signal(false);

  constructor() { this.refresh(); }

  refresh(): void {
    this.loading.set(true);
    this.http.get<ApiPage<StockItem>>(`${API_ENDPOINTS.manufacturer.stockItems}?size=100`).subscribe({
      next: page => {
        this.records.set((page.content ?? []).map(item => ({
          productName: item.name, sku: item.sku, category: item.category ?? 'Uncategorized', terminalId: 'ORG',
          totalStock: item.quantityOnHand, reservedHolds: item.reservedQuantity ?? Math.max(0, item.quantityOnHand - (item.availableQuantity ?? item.quantityOnHand))
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
    return this.records().filter(record => record.terminalId === this.activeTerminalId())
      .filter(record => category === 'All categories' || record.category === category)
      .map(record => {
        const availableNet = Math.max(0, record.totalStock - record.reservedHolds);
        return { ...record, availableNet, alert: availableNet <= 20 ? 'CRITICAL STOCK HOLD' : 'HEALTHY LEVEL' };
      });
  }
  requestAudit(): Observable<unknown> {
    return this.http.post(API_ENDPOINTS.manufacturer.stockAudits, { scope: 'ORGANIZATION', terminalId: this.activeTerminalId() })
      .pipe(tap(() => this.auditRequestSubmitted.set(true)));
  }
  private readonly http = inject(HttpClient);
}
