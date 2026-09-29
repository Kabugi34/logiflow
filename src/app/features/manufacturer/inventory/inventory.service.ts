import { Injectable, signal } from '@angular/core';
import { InventoryRow, InventoryTerminal, TerminalInventoryRecord } from './inventory.models';

@Injectable({ providedIn: 'root' })
export class ManufacturerInventoryService {
  readonly terminals: InventoryTerminal[] = [
    { id: 'CHI-A1', name: 'Terminal Gate A-1 (Chicago)', city: 'Chicago' },
    { id: 'HOU-C4', name: 'Terminal Gate C-4 (Houston)', city: 'Houston' },
    { id: 'LA-W2', name: 'Terminal Gate W-2 (L.A.)', city: 'Los Angeles' }
  ];

  private readonly activeTerminalId = signal('CHI-A1');
  private readonly records = signal<TerminalInventoryRecord[]>([
    { productName: 'Heavy Duty Hydraulic Motor', sku: 'HDM-092-X', category: 'Motors', terminalId: 'CHI-A1', totalStock: 450, reservedHolds: 40 },
    { productName: 'High-Precision Gear Box', sku: 'HPG-881-A', category: 'Transmission', terminalId: 'CHI-A1', totalStock: 120, reservedHolds: 100 },
    { productName: 'Voltage Regulator Block', sku: 'VRB-332-Y', category: 'Electronics', terminalId: 'CHI-A1', totalStock: 1240, reservedHolds: 0 },
    { productName: 'Pneumatic Control Valve', sku: 'PCV-404-Z', category: 'Valves', terminalId: 'CHI-A1', totalStock: 14, reservedHolds: 12 },
    { productName: 'Heavy Duty Hydraulic Motor', sku: 'HDM-092-X', category: 'Motors', terminalId: 'HOU-C4', totalStock: 202, reservedHolds: 12 },
    { productName: 'High-Precision Gear Box', sku: 'HPG-881-A', category: 'Transmission', terminalId: 'HOU-C4', totalStock: 100, reservedHolds: 0 },
    { productName: 'Pneumatic Control Valve', sku: 'PCV-404-Z', category: 'Valves', terminalId: 'HOU-C4', totalStock: 14, reservedHolds: 2 },
    { productName: 'Heavy Duty Hydraulic Motor', sku: 'HDM-092-X', category: 'Motors', terminalId: 'LA-W2', totalStock: 20, reservedHolds: 0 }
  ]);

  readonly auditRequestSubmitted = signal(false);

  getTerminalId(): string {
    return this.activeTerminalId();
  }

  setTerminal(terminalId: string): void {
    this.activeTerminalId.set(terminalId);
    this.auditRequestSubmitted.set(false);
  }

  getCategories(): string[] {
    return [...new Set(this.records().map(record => record.category))];
  }

  getRows(category = 'All categories'): InventoryRow[] {
    return this.records()
      .filter(record => record.terminalId === this.activeTerminalId())
      .filter(record => category === 'All categories' || record.category === category)
      .map(record => {
        const availableNet = Math.max(0, record.totalStock - record.reservedHolds);
        return {
          ...record,
          availableNet,
          alert: availableNet <= 20 ? 'CRITICAL STOCK HOLD' : 'HEALTHY LEVEL'
        };
      });
  }

  requestAudit(): void {
    this.auditRequestSubmitted.set(true);
  }
}
