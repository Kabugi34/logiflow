import { Injectable, signal } from '@angular/core';
import { ManufacturerWarehouse } from './warehouse.models';

@Injectable({ providedIn: 'root' })
export class ManufacturerWarehouseService {
  private readonly warehouseRecords = signal<ManufacturerWarehouse[]>([]);

  readonly warehouses = this.warehouseRecords.asReadonly();

  findById(id: string): ManufacturerWarehouse | undefined {
    return this.warehouseRecords().find(warehouse => warehouse.id === id);
  }

  createWarehouse(details: { name: string; address: string; city: string; postalCode: string; siteManager: string }): ManufacturerWarehouse {
    const name = details.name.trim();
    if (this.warehouseRecords().some(warehouse => warehouse.name.toLowerCase() === name.toLowerCase())) throw new Error('A warehouse with this name already exists.');
    const warehouse: ManufacturerWarehouse = {
      id: `WH-${Date.now()}`, name, address: details.address.trim(), city: details.city.trim(), postalCode: details.postalCode.trim(),
      status: 'ACTIVE', stockUnits: 0, staffCount: 0, siteManager: details.siteManager.trim(), managerRole: 'Site Manager',
      activities: [], staff: []
    };
    this.warehouseRecords.update(rows => [...rows, warehouse]);
    return warehouse;
  }

  toggleStatus(id: string): boolean {
    const warehouse = this.findById(id);
    if (!warehouse) return false;
    this.warehouseRecords.update(rows => rows.map(row => row.id === id ? { ...row, status: row.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' } : row));
    return true;
  }
}
