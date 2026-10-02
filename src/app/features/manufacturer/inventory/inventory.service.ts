import { Injectable, signal } from '@angular/core';
import { InventoryRow, InventoryTerminal, TerminalInventoryRecord } from './inventory.models';

@Injectable({ providedIn: 'root' })
export class ManufacturerInventoryService {
  readonly terminals: InventoryTerminal[] = [
    { id: 'NBO-A1', name: 'Nairobi Distribution Hub A-1', city: 'Nairobi' },
    { id: 'MBA-C4', name: 'Mombasa Freight Terminal C-4', city: 'Mombasa' },
    { id: 'NAK-W2', name: 'Nakuru Regional Warehouse W-2', city: 'Nakuru' }
  ];

  private readonly activeTerminalId = signal('NBO-A1');
  private readonly records = signal<TerminalInventoryRecord[]>([
    { productName: 'Heavy Duty Hydraulic Motor', sku: 'HDM-092-X', category: 'Motors', terminalId: 'NBO-A1', totalStock: 450, reservedHolds: 40 },
    { productName: 'High-Precision Gear Box', sku: 'HPG-881-A', category: 'Transmission', terminalId: 'NBO-A1', totalStock: 120, reservedHolds: 100 },
    { productName: 'Voltage Regulator Block', sku: 'VRB-332-Y', category: 'Electronics', terminalId: 'NBO-A1', totalStock: 1240, reservedHolds: 0 },
    { productName: 'Pneumatic Control Valve', sku: 'PCV-404-Z', category: 'Valves', terminalId: 'NBO-A1', totalStock: 14, reservedHolds: 12 },
    { productName: 'Heavy Duty Hydraulic Motor', sku: 'HDM-092-X', category: 'Motors', terminalId: 'MBA-C4', totalStock: 202, reservedHolds: 12 },
    { productName: 'High-Precision Gear Box', sku: 'HPG-881-A', category: 'Transmission', terminalId: 'MBA-C4', totalStock: 100, reservedHolds: 0 },
    { productName: 'Pneumatic Control Valve', sku: 'PCV-404-Z', category: 'Valves', terminalId: 'MBA-C4', totalStock: 14, reservedHolds: 2 },
    { productName: 'Heavy Duty Hydraulic Motor', sku: 'HDM-092-X', category: 'Motors', terminalId: 'NAK-W2', totalStock: 20, reservedHolds: 0 }
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
