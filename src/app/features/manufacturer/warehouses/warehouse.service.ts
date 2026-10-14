import { Injectable, signal } from '@angular/core';
import { ManufacturerWarehouse } from './warehouse.models';

@Injectable({ providedIn: 'root' })
export class ManufacturerWarehouseService {
  private readonly warehouseRecords = signal<ManufacturerWarehouse[]>([]);

  readonly warehouses = this.warehouseRecords.asReadonly();

  findById(id: string): ManufacturerWarehouse | undefined {
    return this.warehouseRecords().find(warehouse => warehouse.id === id);
  }
}
